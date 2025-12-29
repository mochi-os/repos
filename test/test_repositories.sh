#!/bin/bash
# Repositories app test suite
# Usage: ./test_repositories.sh

set -e

SCRIPT_DIR="$(dirname "$0")"
CURL_HELPER="/home/alistair/mochi/test/claude/curl.sh"

PASSED=0
FAILED=0
REPO_ENTITY=""

pass() {
    echo "[PASS] $1"
    ((PASSED++)) || true
}

fail() {
    echo "[FAIL] $1: $2"
    ((FAILED++))
}

# Helper to make repository requests
# Entity context uses /-/ prefix for repo-level routes
repo_curl() {
    local method="$1"
    local path="$2"
    shift 2
    "$CURL_HELPER" -a admin -X "$method" "$@" "$BASE_URL$path"
}

# Helper for repo-level routes that need /-/ prefix in entity context
repo_api_curl() {
    local method="$1"
    local path="$2"
    shift 2
    "$CURL_HELPER" -a admin -X "$method" "$@" "$BASE_URL/-$path"
}

echo "=============================================="
echo "Repositories Test Suite"
echo "=============================================="

# ============================================================================
# REPOSITORY CREATION TEST
# ============================================================================

echo ""
echo "--- Repository Creation Test ---"

# Test: Create repository
RESULT=$("$CURL_HELPER" -a admin -X POST -H "Content-Type: application/json" -d '{"name":"test-repo","description":"Test repository"}' "/repositories/create")
if echo "$RESULT" | grep -q '"id":"'; then
    # Handle both {"data":{"id":...}} and {"id":...} formats
    REPO_ENTITY=$(echo "$RESULT" | python3 -c "import sys, json; d=json.load(sys.stdin); print(d.get('data',d).get('id',d.get('id','')))" 2>/dev/null)
    if [ -n "$REPO_ENTITY" ]; then
        pass "Create repository (entity: $REPO_ENTITY)"
        BASE_URL="/repositories/$REPO_ENTITY"
    else
        fail "Create repository" "Could not extract entity ID"
        exit 1
    fi
else
    fail "Create repository" "$RESULT"
    exit 1
fi

echo "Using repository entity: $REPO_ENTITY"

# Test: Create repository with invalid name
RESULT=$("$CURL_HELPER" -a admin -X POST -H "Content-Type: application/json" -d '{"name":"Invalid Name!"}' "/repositories/create")
if echo "$RESULT" | grep -q '"error"'; then
    pass "Reject invalid repository name"
else
    fail "Reject invalid repository name" "$RESULT"
fi

# Test: Create repository without name
RESULT=$("$CURL_HELPER" -a admin -X POST -H "Content-Type: application/json" -d '{}' "/repositories/create")
if echo "$RESULT" | grep -q '"error"'; then
    pass "Reject empty repository name"
else
    fail "Reject empty repository name" "$RESULT"
fi

# ============================================================================
# REPOSITORY INFO TEST
# ============================================================================

echo ""
echo "--- Repository Info Test ---"

# Test: Get repository info
RESULT=$(repo_api_curl GET "/info")
if echo "$RESULT" | grep -q '"name":"test-repo"'; then
    pass "Get repository info"
else
    fail "Get repository info" "$RESULT"
fi

# Test: Repository info includes metadata
RESULT=$(repo_api_curl GET "/info")
if echo "$RESULT" | grep -q '"default_branch":"main"'; then
    pass "Repository has default branch"
else
    fail "Repository has default branch" "$RESULT"
fi

# ============================================================================
# REPOSITORY SETTINGS TESTS
# ============================================================================

echo ""
echo "--- Repository Settings Tests ---"

# Test: Get settings
RESULT=$(repo_api_curl GET "/settings")
if echo "$RESULT" | grep -q '"name":"test-repo"'; then
    pass "Get repository settings"
else
    fail "Get repository settings" "$RESULT"
fi

# Test: Update description
RESULT=$(repo_api_curl POST "/settings/set" -H "Content-Type: application/json" -d '{"description":"Updated description"}')
if echo "$RESULT" | grep -q '"success":true'; then
    pass "Update repository description"
else
    fail "Update repository description" "$RESULT"
fi

# Verify description was updated
RESULT=$(repo_api_curl GET "/settings")
if echo "$RESULT" | grep -q '"description":"Updated description"'; then
    pass "Verify updated description"
else
    fail "Verify updated description" "$RESULT"
fi

# ============================================================================
# ACCESS CONTROL TESTS
# ============================================================================

echo ""
echo "--- Access Control Tests ---"

# Test: List access
RESULT=$(repo_api_curl GET "/access")
if echo "$RESULT" | grep -q '"access":'; then
    pass "List repository access"
else
    fail "List repository access" "$RESULT"
fi

# Test: Set access (grant read to everyone)
RESULT=$(repo_api_curl POST "/access/set" -H "Content-Type: application/json" -d '{"subject":"*","permission":"read"}')
if echo "$RESULT" | grep -q '"success":true'; then
    pass "Set repository access"
else
    fail "Set repository access" "$RESULT"
fi

# Test: Set access without subject
RESULT=$(repo_api_curl POST "/access/set" -H "Content-Type: application/json" -d '{"permission":"read"}')
if echo "$RESULT" | grep -q '"error"'; then
    pass "Reject access set without subject"
else
    fail "Reject access set without subject" "$RESULT"
fi

# Test: Set access with invalid permission
RESULT=$(repo_api_curl POST "/access/set" -H "Content-Type: application/json" -d '{"subject":"*","permission":"invalid"}')
if echo "$RESULT" | grep -q '"error"'; then
    pass "Reject invalid permission"
else
    fail "Reject invalid permission" "$RESULT"
fi

# Test: Revoke access
RESULT=$(repo_api_curl POST "/access/revoke" -H "Content-Type: application/json" -d '{"subject":"*"}')
if echo "$RESULT" | grep -q '"success":true'; then
    pass "Revoke repository access"
else
    fail "Revoke repository access" "$RESULT"
fi

# ============================================================================
# GIT REFS TESTS (Empty Repository)
# ============================================================================

echo ""
echo "--- Git Refs Tests (Empty Repository) ---"

# Test: List refs (empty repo)
RESULT=$(repo_api_curl GET "/refs")
if echo "$RESULT" | grep -q '"refs":'; then
    pass "List refs (empty repo)"
else
    fail "List refs (empty repo)" "$RESULT"
fi

# Test: List branches (empty repo)
RESULT=$(repo_api_curl GET "/branches")
if echo "$RESULT" | grep -q '"branches":'; then
    pass "List branches (empty repo)"
else
    fail "List branches (empty repo)" "$RESULT"
fi

# Test: List tags (empty repo)
RESULT=$(repo_api_curl GET "/tags")
if echo "$RESULT" | grep -q '"tags":'; then
    pass "List tags (empty repo)"
else
    fail "List tags (empty repo)" "$RESULT"
fi

# Test: List commits (empty repo - may return empty or error)
RESULT=$(repo_api_curl GET "/commits")
if echo "$RESULT" | grep -q '"commits":'; then
    pass "List commits (empty repo)"
else
    # Empty repo may return error - that's acceptable
    if echo "$RESULT" | grep -q '"error"'; then
        pass "List commits (empty repo - expected error)"
    else
        fail "List commits (empty repo)" "$RESULT"
    fi
fi

# Test: Tree (empty repo)
RESULT=$(repo_api_curl GET "/tree")
if echo "$RESULT" | grep -q '"entries":' || echo "$RESULT" | grep -q '"error"'; then
    pass "Browse tree (empty repo)"
else
    fail "Browse tree (empty repo)" "$RESULT"
fi

# ============================================================================
# REPOSITORY NOT FOUND TESTS
# ============================================================================

echo ""
echo "--- Not Found Tests ---"

# Test: Get info for nonexistent repo
RESULT=$("$CURL_HELPER" -a admin -X GET "/repositories/nonexistent-repo-xyz/-/info")
if echo "$RESULT" | grep -qi 'error\|not found'; then
    pass "Repository not found"
else
    fail "Repository not found" "$RESULT"
fi

# ============================================================================
# REPOSITORY DELETION TEST
# ============================================================================

echo ""
echo "--- Repository Deletion Test ---"

# Test: Delete repository
RESULT=$(repo_api_curl POST "/delete")
if echo "$RESULT" | grep -q '"success":true'; then
    pass "Delete repository"
else
    fail "Delete repository" "$RESULT"
fi

# Verify repository was deleted
RESULT=$(repo_api_curl GET "/info")
if echo "$RESULT" | grep -qi 'error\|not found'; then
    pass "Verify repository deleted"
else
    fail "Verify repository deleted" "$RESULT"
fi

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
