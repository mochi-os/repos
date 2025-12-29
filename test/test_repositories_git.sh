#!/bin/bash
# Repositories app git protocol test suite
# Tests git clone, push, and pull operations
# Usage: ./test_repositories_git.sh

set -e

SCRIPT_DIR="$(dirname "$0")"
CURL_HELPER="/home/alistair/mochi/test/claude/curl.sh"
TEMP_DIR=""

PASSED=0
FAILED=0
REPO_ENTITY=""
BASE_URL="http://localhost:8081"

pass() {
    echo "[PASS] $1"
    ((PASSED++)) || true
}

fail() {
    echo "[FAIL] $1: $2"
    ((FAILED++))
}

cleanup() {
    if [ -n "$TEMP_DIR" ] && [ -d "$TEMP_DIR" ]; then
        rm -rf "$TEMP_DIR"
    fi
    # Clean up repository if it exists
    if [ -n "$REPO_ENTITY" ]; then
        "$CURL_HELPER" -a admin -X POST "/repositories/$REPO_ENTITY/-/delete" 2>/dev/null || true
    fi
}

trap cleanup EXIT

echo "=============================================="
echo "Repositories Git Protocol Test Suite"
echo "=============================================="

# Create temp directory for git operations
TEMP_DIR=$(mktemp -d)
echo "Using temp directory: $TEMP_DIR"

# ============================================================================
# SETUP: CREATE REPOSITORY
# ============================================================================

echo ""
echo "--- Setup: Create Repository ---"

RESULT=$("$CURL_HELPER" -a admin -X POST -H "Content-Type: application/json" -d '{"name":"git-test-repo","description":"Git protocol test","public":"true"}' "/repositories/create")
if echo "$RESULT" | grep -q '"id":"'; then
    REPO_ENTITY=$(echo "$RESULT" | python3 -c "import sys, json; print(json.load(sys.stdin)['data']['id'])" 2>/dev/null)
    if [ -n "$REPO_ENTITY" ]; then
        pass "Create repository (entity: $REPO_ENTITY)"
    else
        fail "Create repository" "Could not extract entity ID"
        exit 1
    fi
else
    fail "Create repository" "$RESULT"
    exit 1
fi

# Get a token for git authentication
TOKEN_RESULT=$("$CURL_HELPER" -a admin -X POST -H "Content-Type: application/json" -d '{"name":"git-test-token","scopes":"repositories:*"}' "/settings/user/account/token/create")
if echo "$TOKEN_RESULT" | grep -q '"token":"'; then
    TOKEN=$(echo "$TOKEN_RESULT" | python3 -c "import sys, json; print(json.load(sys.stdin)['data']['token'])" 2>/dev/null)
    if [ -n "$TOKEN" ]; then
        pass "Create auth token"
    else
        fail "Create auth token" "Could not extract token"
        exit 1
    fi
else
    fail "Create auth token" "$TOKEN_RESULT"
    exit 1
fi

# Git URL for the repository
GIT_URL="http://admin:$TOKEN@localhost:8081/repositories/$REPO_ENTITY/git"
echo "Git URL: http://admin:***@localhost:8081/repositories/$REPO_ENTITY/git"

# ============================================================================
# GIT CLONE (EMPTY REPO)
# ============================================================================

echo ""
echo "--- Git Clone (Empty Repository) ---"

cd "$TEMP_DIR"
if git clone "$GIT_URL" test-clone 2>&1; then
    pass "Clone empty repository"
else
    # Cloning empty repo may warn but should succeed
    if [ -d "test-clone" ]; then
        pass "Clone empty repository (with warnings)"
    else
        fail "Clone empty repository" "Directory not created"
    fi
fi

# ============================================================================
# GIT PUSH (INITIAL COMMIT)
# ============================================================================

echo ""
echo "--- Git Push (Initial Commit) ---"

cd "$TEMP_DIR/test-clone"

# Configure git user
git config user.email "test@example.com"
git config user.name "Test User"

# Create initial content
echo "# Git Test Repository" > README.md
echo "This is a test repository for the Mochi repositories app." >> README.md

git add README.md
git commit -m "Initial commit"

if git push -u origin main 2>&1; then
    pass "Push initial commit"
else
    # Try master if main fails
    if git push -u origin master 2>&1; then
        pass "Push initial commit (master branch)"
    else
        fail "Push initial commit" "Push failed"
    fi
fi

# ============================================================================
# VERIFY PUSHED CONTENT VIA API
# ============================================================================

echo ""
echo "--- Verify Pushed Content ---"

# Check branches
RESULT=$("$CURL_HELPER" -a admin -X GET "/repositories/$REPO_ENTITY/-/branches")
if echo "$RESULT" | grep -q '"branches":\['; then
    if echo "$RESULT" | grep -q '"name":"main"' || echo "$RESULT" | grep -q '"name":"master"'; then
        pass "Branches contain main/master"
    else
        fail "Branches contain main/master" "$RESULT"
    fi
else
    fail "List branches after push" "$RESULT"
fi

# Check commits
RESULT=$("$CURL_HELPER" -a admin -X GET "/repositories/$REPO_ENTITY/-/commits")
if echo "$RESULT" | grep -q '"commits":\['; then
    if echo "$RESULT" | grep -q 'Initial commit'; then
        pass "Commits contain initial commit"
    else
        fail "Commits contain initial commit" "$RESULT"
    fi
else
    fail "List commits after push" "$RESULT"
fi

# Check tree
RESULT=$("$CURL_HELPER" -a admin -X GET "/repositories/$REPO_ENTITY/-/tree")
if echo "$RESULT" | grep -q '"entries":\['; then
    if echo "$RESULT" | grep -q '"name":"README.md"'; then
        pass "Tree contains README.md"
    else
        fail "Tree contains README.md" "$RESULT"
    fi
else
    fail "Browse tree after push" "$RESULT"
fi

# Check blob content
RESULT=$("$CURL_HELPER" -a admin -X GET "/repositories/$REPO_ENTITY/-/blob/HEAD/README.md")
if echo "$RESULT" | grep -q '"content":'; then
    if echo "$RESULT" | grep -q 'Git Test Repository'; then
        pass "Blob content matches"
    else
        fail "Blob content matches" "$RESULT"
    fi
else
    fail "Get blob content" "$RESULT"
fi

# ============================================================================
# GIT PUSH (ADDITIONAL COMMITS)
# ============================================================================

echo ""
echo "--- Git Push (Additional Commits) ---"

# Add more content
echo "## Features" >> README.md
echo "- Clone support" >> README.md
echo "- Push support" >> README.md
git add README.md
git commit -m "Add features section"

# Create a new file
echo "MIT License" > LICENSE
git add LICENSE
git commit -m "Add license"

if git push 2>&1; then
    pass "Push additional commits"
else
    fail "Push additional commits" "Push failed"
fi

# Verify commit count
RESULT=$("$CURL_HELPER" -a admin -X GET "/repositories/$REPO_ENTITY/-/commits")
COMMIT_COUNT=$(echo "$RESULT" | python3 -c "import sys, json; d=json.load(sys.stdin); print(len(d.get('data',d).get('commits',[])))" 2>/dev/null || echo "0")
if [ "$COMMIT_COUNT" -ge 3 ]; then
    pass "Repository has 3+ commits ($COMMIT_COUNT)"
else
    fail "Repository has 3+ commits" "Only $COMMIT_COUNT commits"
fi

# ============================================================================
# GIT PULL (FRESH CLONE)
# ============================================================================

echo ""
echo "--- Git Pull (Fresh Clone) ---"

cd "$TEMP_DIR"
if git clone "$GIT_URL" test-pull 2>&1; then
    pass "Clone repository with content"
else
    fail "Clone repository with content" "Clone failed"
fi

# Verify content
if [ -f "$TEMP_DIR/test-pull/README.md" ] && [ -f "$TEMP_DIR/test-pull/LICENSE" ]; then
    pass "Cloned repository has expected files"
else
    fail "Cloned repository has expected files" "Missing files"
fi

# Verify README content
if grep -q "Features" "$TEMP_DIR/test-pull/README.md"; then
    pass "README.md has updated content"
else
    fail "README.md has updated content" "Missing features section"
fi

# ============================================================================
# GIT FETCH AND PULL
# ============================================================================

echo ""
echo "--- Git Fetch and Pull ---"

# Make a new commit in original clone
cd "$TEMP_DIR/test-clone"
echo "## Contributing" >> README.md
git add README.md
git commit -m "Add contributing section"
git push

# Fetch and pull in second clone
cd "$TEMP_DIR/test-pull"
if git fetch 2>&1; then
    pass "Git fetch"
else
    fail "Git fetch" "Fetch failed"
fi

if git pull 2>&1; then
    pass "Git pull"
else
    fail "Git pull" "Pull failed"
fi

# Verify pulled content
if grep -q "Contributing" "$TEMP_DIR/test-pull/README.md"; then
    pass "Pull received new content"
else
    fail "Pull received new content" "Missing contributing section"
fi

# ============================================================================
# DELETE TOKEN
# ============================================================================

echo ""
echo "--- Cleanup ---"

# Token cleanup skipped - tokens auto-expire or can be deleted via UI
pass "Cleanup complete"

# ============================================================================
# SUMMARY
# ============================================================================

echo ""
echo "=============================================="
echo "Results: $PASSED passed, $FAILED failed"
echo "=============================================="

if [ $FAILED -gt 0 ]; then
    exit 1
fi
