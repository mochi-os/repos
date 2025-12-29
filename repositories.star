# Mochi Repositories app
# Copyright Alistair Cunningham 2025

# Database schema
def database_create():
    mochi.db.execute("""
        create table repositories (
            id text primary key not null,
            name text not null default '',
            description text not null default '',
            default_branch text not null default 'main',
            size integer not null default 0,
            created text not null default '',
            updated text not null default ''
        )
    """)
    mochi.db.execute("create index repositories_name on repositories(name)")

# Action: Get class info - returns list of repositories for class context
def action_info_class(a):
    repos = mochi.db.rows("select id, name, description, default_branch, size, created, updated from repositories order by name")
    return {"data": {"entity": False, "repositories": repos or []}}

# Helper: Get repository from route parameter
# Entity resolution uses class name "repository", not route param ":repo"
def get_repo(a):
    repo_id = a.input("repository")
    if not repo_id:
        return None
    return mochi.db.row("select * from repositories where id = ?", repo_id)

# Action: Get entity info - returns repository details for entity context
def action_info_entity(a):
    repo = get_repo(a)
    if not repo:
        return a.error(404, "Repository not found")

    # Get repository stats
    branches = mochi.git.branches(repo["id"])
    tags = mochi.git.tags(repo["id"])

    return {"data": {
        "entity": True,
        "id": repo["id"],
        "name": repo["name"],
        "description": repo["description"],
        "default_branch": repo["default_branch"],
        "size": repo["size"],
        "created": repo["created"],
        "updated": repo["updated"],
        "branches": len(branches) if branches else 0,
        "tags": len(tags) if tags else 0,
    }}

# Action: Create repository
def action_create(a):
    name = a.input("name")
    description = a.input("description", "")
    public = a.input("public", "false") == "true"

    if not name:
        return a.error(400, "Name is required")

    if len(name) > 100:
        return a.error(400, "Name is too long (max 100 characters)")

    # Create entity (returns entity ID string)
    entity_id = mochi.entity.create("repository", name, "public" if public else "private", "")
    if not entity_id:
        return a.error(500, "Failed to create entity")

    # Initialize git repository
    result = mochi.git.init(entity_id)
    if not result:
        mochi.entity.delete(entity_id)
        return a.error(500, "Failed to initialize git repository")

    # Create database record
    now = mochi.time.now()
    mochi.db.execute("""
        insert into repositories (id, name, description, default_branch, created, updated)
        values (?, ?, ?, 'main', ?, ?)
    """, entity_id, name, description, now, now)

    # Set up access control
    if a.user and a.user.identity:
        mochi.access.allow(a.user.identity.id, "repo/" + entity_id, "*", a.user.identity.id)

    if public:
        mochi.access.allow("*", "repo/" + entity_id, "read", a.user.identity.id if a.user else "")

    return {"data": {"id": entity_id, "name": name, "url": "/" + entity_id}}

# Action: Repository settings
def action_settings(a):
    repo = get_repo(a)
    if not repo:
        return a.error(404, "Repository not found")

    if not check_write_access(a, repo["id"]):
        return a.error(403, "Access denied")

    row = mochi.db.row("select * from repositories where id = ?", repo["id"])
    if not row:
        return a.error(404, "Repository not found")

    a.json({
        "id": repo["id"],
        "name": row["name"],
        "description": row["description"],
        "default_branch": row["default_branch"],
    })

# Action: Update repository settings
def action_settings_set(a):
    repo = get_repo(a)
    if not repo:
        return a.error(404, "Repository not found")

    if not check_write_access(a, repo["id"]):
        return a.error(403, "Access denied")

    description = a.input("description")
    default_branch = a.input("default_branch")

    updates = []
    params = []

    if description != None:
        updates.append("description = ?")
        params.append(description)

    if default_branch:
        # Verify branch exists
        branches = mochi.git.branches(repo["id"])
        branch_names = [b["name"] for b in branches] if branches else []
        if default_branch not in branch_names:
            return a.error(400, "Branch does not exist")
        updates.append("default_branch = ?")
        params.append(default_branch)
        mochi.git.branch.default.set(repo["id"], default_branch)

    if updates:
        updates.append("updated = ?")
        params.append(mochi.time.now())
        params.append(repo["id"])
        mochi.db.execute("update repositories set " + ", ".join(updates) + " where id = ?", *params)

    a.json({"success": True})

# Action: Delete repository
def action_delete(a):
    repo = get_repo(a)
    if not repo:
        return a.error(404, "Repository not found")

    if not check_admin_access(a, repo["id"]):
        return a.error(403, "Access denied")

    # Delete git repository
    mochi.git.delete(repo["id"])

    # Delete database record
    mochi.db.execute("delete from repositories where id = ?", repo["id"])

    # Delete entity
    mochi.entity.delete(repo["id"])

    a.json({"success": True})

# Action: List access
def action_access_list(a):
    repo = get_repo(a)
    if not repo:
        return a.error(404, "Repository not found")

    if not check_write_access(a, repo["id"]):
        return a.error(403, "Access denied")

    access = mochi.access.list.resource("repo/" + repo["id"])
    a.json({"access": access or []})

# Action: Set access
def action_access_set(a):
    repo = get_repo(a)
    if not repo:
        return a.error(404, "Repository not found")

    if not check_admin_access(a, repo["id"]):
        return a.error(403, "Access denied")

    subject = a.input("subject")
    permission = a.input("permission")

    if not subject or not permission:
        return a.error(400, "Subject and permission are required")

    if permission not in ["read", "write", "admin", "*"]:
        return a.error(400, "Invalid permission")

    owner_id = a.user.identity.id if a.user and a.user.identity else ""
    mochi.access.allow(subject, "repo/" + repo["id"], permission, owner_id)

    a.json({"success": True})

# Action: Revoke access
def action_access_revoke(a):
    repo = get_repo(a)
    if not repo:
        return a.error(404, "Repository not found")

    if not check_admin_access(a, repo["id"]):
        return a.error(403, "Access denied")

    subject = a.input("subject")
    permission = a.input("permission", "*")

    if not subject:
        return a.error(400, "Subject is required")

    owner_id = a.user.identity.id if a.user and a.user.identity else ""
    mochi.access.deny(subject, "repo/" + repo["id"], permission, owner_id)

    a.json({"success": True})

# Action: List refs (branches and tags)
def action_refs(a):
    repo = get_repo(a)
    if not repo:
        return a.error(404, "Repository not found")

    if not check_read_access(a, repo["id"]):
        return a.error(403, "Access denied")

    refs = mochi.git.refs(repo["id"])
    a.json({"refs": refs or []})

# Action: List branches
def action_branches(a):
    repo = get_repo(a)
    if not repo:
        return a.error(404, "Repository not found")

    if not check_read_access(a, repo["id"]):
        return a.error(403, "Access denied")

    branches = mochi.git.branches(repo["id"])
    default = mochi.git.branch.default.get(repo["id"])

    a.json({
        "branches": branches or [],
        "default": default,
    })

# Action: List tags
def action_tags(a):
    repo = get_repo(a)
    if not repo:
        return a.error(404, "Repository not found")

    if not check_read_access(a, repo["id"]):
        return a.error(403, "Access denied")

    tags = mochi.git.tags(repo["id"])
    a.json({"tags": tags or []})

# Action: List commits
def action_commits(a):
    repo = get_repo(a)
    if not repo:
        return a.error(404, "Repository not found")

    if not check_read_access(a, repo["id"]):
        return a.error(403, "Access denied")

    ref = a.input("ref") or "HEAD"
    limit = int(a.input("limit", "50"))
    offset = int(a.input("offset", "0"))

    commits = mochi.git.commit.list(repo["id"], ref, limit, offset)
    a.json({"commits": commits or []})

# Action: Get commit details
def action_commit(a):
    repo = get_repo(a)
    if not repo:
        return a.error(404, "Repository not found")

    if not check_read_access(a, repo["id"]):
        return a.error(403, "Access denied")

    sha = a.input("sha")
    if not sha:
        return a.error(400, "Commit SHA is required")

    commit = mochi.git.commit.get(repo["id"], sha)
    if not commit:
        return a.error(404, "Commit not found")

    a.json({"commit": commit})

# Action: Browse tree
def action_tree(a):
    repo = get_repo(a)
    if not repo:
        return a.error(404, "Repository not found")

    if not check_read_access(a, repo["id"]):
        return a.error(403, "Access denied")

    ref = a.input("ref") or "HEAD"
    path = a.input("path") or ""

    tree = mochi.git.tree(repo["id"], ref, path)
    if tree == None:
        return a.error(404, "Path not found")

    a.json({
        "ref": ref,
        "path": path,
        "entries": tree or [],
    })

# Action: Get blob content
def action_blob(a):
    repo = get_repo(a)
    if not repo:
        return a.error(404, "Repository not found")

    if not check_read_access(a, repo["id"]):
        return a.error(403, "Access denied")

    ref = a.input("ref") or "HEAD"
    path = a.input("path")

    if not path:
        return a.error(400, "Path is required")

    blob = mochi.git.blob.get(repo["id"], ref, path)
    if not blob:
        return a.error(404, "File not found")

    # For small non-binary files, include content
    content = None
    if not blob.get("binary", False) and blob.get("size", 0) < 1024 * 1024:
        content = mochi.git.blob.content(repo["id"], ref, path)

    a.json({
        "ref": ref,
        "path": path,
        "sha": blob.get("sha", ""),
        "size": blob.get("size", 0),
        "binary": blob.get("binary", False),
        "content": content,
    })

# Action: Open Graph meta tags
def action_opengraph(a):
    repo = get_repo(a)
    if not repo:
        return None

    row = mochi.db.row("select * from repositories where id = ?", repo["id"])
    if not row:
        return None

    title = row["name"]
    description = row["description"] or "Git repository"

    return {
        "title": title,
        "description": description,
        "type": "website",
    }

# Action: Search users (for access control UI)
def action_users_search(a):
    query = a.input("q", "")
    results = mochi.directory.search(query, 10)
    a.json({"results": results or []})

# Action: List groups
def action_groups(a):
    groups = mochi.group.list()
    a.json({"groups": groups or []})

# Service interface for other apps

def service_list(s):
    """List repositories owned by current user"""
    return mochi.db.rows("select id, name, description, default_branch from repositories")

def service_get(s):
    """Get repository details"""
    repo_id = s.input("id")
    return mochi.db.row("select * from repositories where id = ?", repo_id)

def service_branches(s):
    """List branches for a repository"""
    repo_id = s.input("repo")
    return mochi.git.branches(repo_id)

def service_file(s):
    """Get file contents at a ref"""
    repo_id = s.input("repo")
    ref = s.input("ref") or "HEAD"
    path = s.input("path")
    return mochi.git.blob.content(repo_id, ref, path)

def service_tree(s):
    """List directory at a ref"""
    repo_id = s.input("repo")
    ref = s.input("ref") or "HEAD"
    path = s.input("path") or ""
    return mochi.git.tree(repo_id, ref, path)

def service_commits(s):
    """List commits between two refs"""
    repo_id = s.input("repo")
    base = s.input("base")
    head = s.input("head")
    if base and head:
        return mochi.git.commit.between(repo_id, base, head)
    return mochi.git.commit.list(repo_id, head or "HEAD", 50, 0)

def service_diff(s):
    """Get diff between refs (for PR display)"""
    repo_id = s.input("repo")
    base = s.input("base")
    head = s.input("head")
    return mochi.git.diff(repo_id, base, head)

def service_can_merge(s):
    """Check if branches can be merged cleanly"""
    repo_id = s.input("repo")
    source = s.input("source")
    target = s.input("target")
    return mochi.git.merge.check(repo_id, source, target)

# Helper functions

def check_read_access(a, repo_id):
    """Check if user has read access to repository"""
    user_id = a.user.identity.id if a.user and a.user.identity else "*"
    return mochi.access.check(user_id, "repo/" + repo_id, "read")

def check_write_access(a, repo_id):
    """Check if user has write access to repository"""
    if not a.user or not a.user.identity:
        return False
    return mochi.access.check(a.user.identity.id, "repo/" + repo_id, "write")

def check_admin_access(a, repo_id):
    """Check if user has admin access to repository"""
    if not a.user or not a.user.identity:
        return False
    return mochi.access.check(a.user.identity.id, "repo/" + repo_id, "admin")
