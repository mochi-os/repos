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
            owner integer not null default 1,
            server text not null default '',
            created text not null default '',
            updated text not null default ''
        )
    """)
    mochi.db.execute("create index repositories_name on repositories(name)")
    mochi.db.execute("create index repositories_owner on repositories(owner)")

    # Subscribers table - tracks who subscribes to local repositories
    mochi.db.execute("""
        create table subscribers (
            repository text not null,
            id text not null,
            name text not null default '',
            subscribed integer not null,
            primary key (repository, id)
        )
    """)
    mochi.db.execute("create index subscribers_id on subscribers(id)")

# Database upgrade - called once per version from (current+1) to target
def database_upgrade(version):
    if version == 2:
        # Add owner and server columns for remote repository subscriptions
        mochi.db.execute("alter table repositories add column owner integer not null default 1")
        mochi.db.execute("alter table repositories add column server text not null default ''")
        mochi.db.execute("create index if not exists repositories_owner on repositories(owner)")

        # Create subscribers table
        mochi.db.execute("""
            create table if not exists subscribers (
                repository text not null,
                id text not null,
                name text not null default '',
                subscribed integer not null,
                primary key (repository, id)
            )
        """)
        mochi.db.execute("create index if not exists subscribers_id on subscribers(id)")

# Action: Get class info - returns list of repositories for class context
def action_info_class(a):
    repos = mochi.db.rows("select id, name, description, default_branch, size, owner, server, created, updated from repositories order by name")
    # Add fingerprint to each repository
    if repos:
        for repo in repos:
            repo["fingerprint"] = mochi.entity.fingerprint(repo["id"])
    return {"data": {"entity": False, "repositories": repos or []}}

# Helper: Check if string is a valid entity identifier (fingerprint or entity ID)
# Fingerprint: 9 chars base58, Entity ID: 50-51 chars base58
def is_valid_identifier(s):
    if not s:
        return False
    length = len(s)
    if length != 9 and length != 50 and length != 51:
        return False
    # Base58 character set (excludes 0, O, I, l)
    base58_chars = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"
    for i in range(length):
        if s[i] not in base58_chars:
            return False
    return True

# Helper: Get repository from route parameter
# Route parameter may be fingerprint or entity ID - resolve to entity ID first
def get_repo(a):
    repo_param = a.input("repository")
    if not repo_param:
        return None

    # Validate identifier format before calling entity.info
    if not is_valid_identifier(repo_param):
        return None

    # First try to find directly in database (works for both owned and subscribed repos)
    repo = mochi.db.row("select * from repositories where id = ?", repo_param)
    if repo:
        return repo

    # Try by fingerprint - check all repos
    repos = mochi.db.rows("select * from repositories")
    for r in repos:
        if mochi.entity.fingerprint(r["id"]) == repo_param:
            return r

    # Resolve fingerprint/ID to entity info (for local entities only)
    entity = mochi.entity.info(repo_param)
    if not entity:
        return None

    return mochi.db.row("select * from repositories where id = ?", entity["id"])

# Action: Get entity info - returns repository details for entity context
def action_info_entity(a):
    repo = get_repo(a)
    if not repo:
        return a.error(404, "Repository not found")

    # Check if this is a subscribed remote repository
    is_remote = repo.get("owner", 1) == 0
    server = repo.get("server", "")

    mochi.log.debug("action_info_entity: id=%s, owner=%s, is_remote=%s, server=%s" % (repo.get("id"), repo.get("owner"), is_remote, server))

    if is_remote:
        # Fetch live data from remote server
        peer = mochi.remote.peer(server) if server and server.startswith("http") else None if server and server.startswith("http") else None
        if peer:
            response = mochi.remote.request(repo["id"], "repositories", "info", {"repository": repo["id"]}, peer)
            if not response.get("error"):
                # Update cached data
                mochi.db.execute("""
                    update repositories set name = ?, description = ?, default_branch = ?, updated = ?
                    where id = ?
                """, response.get("name", repo["name"]),
                    response.get("description", repo["description"]),
                    response.get("default_branch", repo["default_branch"]),
                    mochi.time.now(), repo["id"])

                return {"data": {
                    "entity": True,
                    "id": repo["id"],
                    "fingerprint": response.get("fingerprint", mochi.entity.fingerprint(repo["id"])),
                    "name": response.get("name", repo["name"]),
                    "description": response.get("description", repo["description"]),
                    "default_branch": response.get("default_branch", repo["default_branch"]),
                    "size": repo["size"],
                    "created": repo["created"],
                    "updated": repo["updated"],
                    "branches": 0,
                    "tags": 0,
                    "allow_read": True,
                    "privacy": "public",
                    "isAdmin": False,
                    "owner": 0,
                    "server": server,
                    "remote": True,
                }}

        # Fall back to cached data if remote is unavailable
        return {"data": {
            "entity": True,
            "id": repo["id"],
            "fingerprint": mochi.entity.fingerprint(repo["id"]),
            "name": repo["name"],
            "description": repo["description"],
            "default_branch": repo["default_branch"],
            "size": repo["size"],
            "created": repo["created"],
            "updated": repo["updated"],
            "branches": 0,
            "tags": 0,
            "allow_read": True,
            "privacy": "public",
            "isAdmin": False,
            "owner": 0,
            "server": server,
            "remote": True,
        }}

    # Local repository - get full stats
    branches = mochi.git.branches(repo["id"])
    tags = mochi.git.tags(repo["id"])

    # Get entity privacy setting
    entity_info = mochi.entity.info(repo["id"])
    privacy = entity_info["privacy"] if entity_info else "private"

    # Check if public read access is enabled
    allow_read = False
    access = mochi.access.list.resource("repo/" + repo["id"])
    if access:
        for entry in access:
            if entry.get("subject") == "*" and entry.get("operation") == "read" and entry.get("grant") == 1:
                allow_read = True
                break

    return {"data": {
        "entity": True,
        "id": repo["id"],
        "fingerprint": mochi.entity.fingerprint(repo["id"]),
        "name": repo["name"],
        "description": repo["description"],
        "default_branch": repo["default_branch"],
        "size": repo["size"],
        "created": repo["created"],
        "updated": repo["updated"],
        "branches": len(branches) if branches else 0,
        "tags": len(tags) if tags else 0,
        "allow_read": allow_read,
        "privacy": privacy,
        "isAdmin": check_admin_access(a, repo["id"]),
        "owner": 1,
        "server": "",
        "remote": False,
    }}

# Action: Create repository
def action_create(a):
    name = a.input("name")
    description = a.input("description", "")
    allow_read = a.input("allow_read", "true") != "false"
    privacy = a.input("privacy", "public")

    if not name:
        return a.error(400, "Name is required")

    if len(name) > 100:
        return a.error(400, "Name is too long (max 100 characters)")

    # Check for duplicate name
    existing = mochi.db.row("select id from repositories where name = ?", name)
    if existing:
        return a.error(400, "A repository with that name already exists")

    # Create entity (privacy controls directory listing)
    entity_id = mochi.entity.create("repository", name, privacy, "")
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

    # Public read access (allow anyone to read)
    if allow_read:
        mochi.access.allow("*", "repo/" + entity_id, "read", a.user.identity.id if a.user else "")

    fingerprint = mochi.entity.fingerprint(entity_id)
    return {"data": {"id": entity_id, "fingerprint": fingerprint, "name": name, "url": "/" + fingerprint}}

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
    allow_read = a.input("allow_read")
    privacy = a.input("privacy")

    updates = []
    params = []

    if description:
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

        # Broadcast update to subscribers (only for owned repos)
        if repo.get("owner", 1) == 1:
            updated_repo = mochi.db.row("select * from repositories where id = ?", repo["id"])
            if updated_repo:
                broadcast_update(updated_repo)

    # Update public read access
    owner_id = a.user.identity.id if a.user and a.user.identity else ""
    if allow_read == "true":
        mochi.access.allow("*", "repo/" + repo["id"], "read", owner_id)
    elif allow_read == "false":
        mochi.access.deny("*", "repo/" + repo["id"], "read", owner_id)

    # Update entity privacy (directory listing)
    if privacy in ["public", "private"]:
        mochi.entity.privacy.set(repo["id"], privacy)

    a.json({"success": True})

# Action: Delete repository
def action_delete(a):
    repo = get_repo(a)
    if not repo:
        return a.error(404, "Repository not found")

    if not check_admin_access(a, repo["id"]):
        return a.error(403, "Access denied")

    # Notify subscribers before deletion (only for owned repos)
    if repo.get("owner", 1) == 1:
        broadcast_deleted(repo)

    # Delete subscribers
    mochi.db.execute("delete from subscribers where repository = ?", repo["id"])

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

    # Get owner - if we own this entity, use current user's info
    owner = None
    if mochi.entity.get(repo["id"]):
        if a.user and a.user.identity:
            owner = {"id": a.user.identity.id, "name": a.user.identity.name}

    resource = "repo/" + repo["id"]
    rules = mochi.access.list.resource(resource)

    # Resolve names for rules and mark owner
    filtered_rules = []
    for rule in rules or []:
        subject = rule.get("subject", "")
        # Mark owner rules
        if owner and subject == owner.get("id"):
            rule["isOwner"] = True
        # Resolve names for non-special subjects
        if subject and subject not in ("*", "+") and not subject.startswith("#"):
            if subject.startswith("@"):
                # Look up group name
                group_id = subject[1:]
                group = mochi.group.get(group_id)
                if group:
                    rule["name"] = group.get("name", group_id)
            elif mochi.valid(subject, "entity"):
                # Try directory first (for user identities), then local entities
                entry = mochi.directory.get(subject)
                if entry:
                    rule["name"] = entry.get("name", "")
                else:
                    entity = mochi.entity.info(subject)
                    if entity:
                        rule["name"] = entity.get("name", "")
        filtered_rules.append(rule)

    a.json({"rules": filtered_rules})

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

    if permission not in ["read", "write", "none"]:
        return a.error(400, "Invalid permission")

    resource = "repo/" + repo["id"]
    granter = a.user.identity.id if a.user and a.user.identity else ""

    # Revoke all existing rules for this subject first
    for op in ["read", "write", "*"]:
        mochi.access.revoke(subject, resource, op)

    # Set the new permission
    if permission == "none":
        # Deny all access
        mochi.access.deny(subject, resource, "*", granter)
    else:
        mochi.access.allow(subject, resource, permission, granter)

    a.json({"success": True})

# Action: Revoke access
def action_access_revoke(a):
    repo = get_repo(a)
    if not repo:
        return a.error(404, "Repository not found")

    if not check_admin_access(a, repo["id"]):
        return a.error(403, "Access denied")

    subject = a.input("subject")

    if not subject:
        return a.error(400, "Subject is required")

    resource = "repo/" + repo["id"]

    # Remove all rules for this subject
    for op in ["read", "write", "*"]:
        mochi.access.revoke(subject, resource, op)

    a.json({"success": True})

# Action: List refs (branches and tags)
def action_refs(a):
    repo = get_repo(a)
    if not repo:
        return a.error(404, "Repository not found")

    if not check_read_access(a, repo["id"]):
        return a.error(403, "Access denied")

    # Check if remote repository
    is_remote = repo.get("owner", 1) == 0
    server = repo.get("server", "")

    if is_remote:
        # Fetch from remote server
        peer = mochi.remote.peer(server) if server and server.startswith("http") else None if server and server.startswith("http") else None
        if peer:
            response = mochi.remote.request(repo["id"], "repositories", "refs", {"repository": repo["id"]}, peer)
            if not response.get("error"):
                return a.json(response)
        # Fall through to return empty if remote unavailable
        return a.json({"refs": []})

    # Local repository
    refs = mochi.git.refs(repo["id"])
    a.json({"refs": refs or []})

# Action: List branches
def action_branches(a):
    repo = get_repo(a)
    if not repo:
        return a.error(404, "Repository not found")

    if not check_read_access(a, repo["id"]):
        return a.error(403, "Access denied")

    # Check if remote repository
    is_remote = repo.get("owner", 1) == 0
    server = repo.get("server", "")

    if is_remote:
        # Fetch from remote server
        peer = mochi.remote.peer(server) if server and server.startswith("http") else None if server and server.startswith("http") else None
        if peer:
            response = mochi.remote.request(repo["id"], "repositories", "branches", {"repository": repo["id"]}, peer)
            if not response.get("error"):
                return a.json(response)
        # Fall through to return empty if remote unavailable
        return a.json({"branches": [], "default": repo.get("default_branch", "main")})

    # Local repository
    branches = mochi.git.branches(repo["id"])
    default = mochi.git.branch.default.get(repo["id"])

    a.json({
        "branches": branches or [],
        "default": default,
    })

# Action: Create branch
def action_branch_create(a):
    repo = get_repo(a)
    if not repo:
        return a.error(404, "Repository not found")
    if not check_write_access(a, repo["id"]):
        return a.error(403, "Access denied")

    name = a.input("name")
    source = a.input("source") or "HEAD"

    if not name:
        return a.error(400, "Branch name is required")

    result = mochi.git.branch.create(repo["id"], name, source)
    if not result:
        return a.error(400, "Failed to create branch")

    a.json({"success": True, "name": name})

# Action: Delete branch
def action_branch_delete(a):
    repo = get_repo(a)
    if not repo:
        return a.error(404, "Repository not found")
    if not check_write_access(a, repo["id"]):
        return a.error(403, "Access denied")

    name = a.input("name")
    if not name:
        return a.error(400, "Branch name is required")

    default = mochi.git.branch.default.get(repo["id"])
    if name == default:
        return a.error(400, "Cannot delete the default branch")

    result = mochi.git.branch.delete(repo["id"], name)
    if not result:
        return a.error(400, "Failed to delete branch")

    a.json({"success": True})

# Action: List tags
def action_tags(a):
    repo = get_repo(a)
    if not repo:
        return a.error(404, "Repository not found")

    if not check_read_access(a, repo["id"]):
        return a.error(403, "Access denied")

    # Check if remote repository
    is_remote = repo.get("owner", 1) == 0
    server = repo.get("server", "")

    if is_remote:
        # Fetch from remote server
        peer = mochi.remote.peer(server) if server and server.startswith("http") else None if server and server.startswith("http") else None
        if peer:
            response = mochi.remote.request(repo["id"], "repositories", "tags", {"repository": repo["id"]}, peer)
            if not response.get("error"):
                return a.json(response)
        # Fall through to return empty if remote unavailable
        return a.json({"tags": []})

    # Local repository
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

    # Check if remote repository
    is_remote = repo.get("owner", 1) == 0
    server = repo.get("server", "")

    if is_remote:
        # Fetch from remote server
        peer = mochi.remote.peer(server) if server and server.startswith("http") else None if server and server.startswith("http") else None
        if peer:
            response = mochi.remote.request(repo["id"], "repositories", "commits", {
                "repository": repo["id"],
                "ref": ref,
                "limit": str(limit),
                "offset": str(offset)
            }, peer)
            if not response.get("error"):
                return a.json(response)
        # Fall through to return empty if remote unavailable
        return a.json({"commits": []})

    # Local repository
    commits = mochi.git.commit.list(repo["id"], ref, limit, offset)
    if commits == None:
        return a.error(404, "Branch or tag '%s' not found." % ref)
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

    # Check if remote repository
    is_remote = repo.get("owner", 1) == 0
    server = repo.get("server", "")

    if is_remote:
        # Fetch from remote server
        # If server is a URL, resolve to peer; if peer ID or empty, pass None for directory lookup
        peer = mochi.remote.peer(server) if server and server.startswith("http") else None if server and server.startswith("http") else None if server and server.startswith("http") else None
        response = mochi.remote.request(repo["id"], "repositories", "tree", {
            "repository": repo["id"],
            "ref": ref,
            "path": path
        }, peer)
        if not response.get("error"):
            return a.json(response)
        # Fall through to return empty/error if remote unavailable
        return a.json({"ref": ref, "path": path, "entries": []})

    # Local repository
    tree = mochi.git.tree(repo["id"], ref, path)
    if tree == None:
        # Check if ref exists by trying to get tree at root
        if path:
            root_tree = mochi.git.tree(repo["id"], ref, "")
            if root_tree == None:
                return a.error(404, "Branch or tag '%s' not found." % ref)
            return a.error(404, "Path '%s' not found." % path)
        # Check if repository is empty (no branches or tags at all)
        branches = mochi.git.branches(repo["id"])
        tags = mochi.git.tags(repo["id"])
        if (not branches or len(branches) == 0) and (not tags or len(tags) == 0):
            # Empty repository is normal, return success with empty entries
            return a.json({
                "ref": ref,
                "path": path,
                "entries": [],
            })
        return a.error(404, "Branch or tag '%s' not found." % ref)

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

    # Check if remote repository
    is_remote = repo.get("owner", 1) == 0
    server = repo.get("server", "")

    if is_remote:
        # Fetch from remote server
        # If server is a URL, resolve to peer; if peer ID or empty, pass None for directory lookup
        peer = mochi.remote.peer(server) if server and server.startswith("http") else None
        response = mochi.remote.request(repo["id"], "repositories", "blob", {
            "repository": repo["id"],
            "ref": ref,
            "path": path
        }, peer)
        if not response.get("error"):
            return a.json(response)
        # Fall through to error if remote unavailable
        return a.error(404, "File '%s' not found." % path)

    # Local repository
    blob = mochi.git.blob.get(repo["id"], ref, path)
    if not blob:
        # Check if ref exists
        root_tree = mochi.git.tree(repo["id"], ref, "")
        if root_tree == None:
            return a.error(404, "Branch or tag '%s' not found." % ref)
        return a.error(404, "File '%s' not found." % path)

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
    if not a.user:
        return a.error(401, "Not logged in")
    query = a.input("q", "")
    results = mochi.service.call("friends", "users/search", query)
    a.json({"results": results or []})

# Action: List groups
def action_groups(a):
    if not a.user:
        return a.error(401, "Not logged in")
    results = mochi.service.call("friends", "groups/list")
    a.json({"groups": results or []})

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
    # For subscribed remote repositories (owner=0), grant read access automatically
    repo = mochi.db.row("select owner from repositories where id = ?", repo_id)
    if repo and repo.get("owner", 1) == 0:
        # Subscribed repository - user has read access by virtue of subscription
        return True

    # For local repositories, check access control
    # Pass None for anonymous users - "*" would be treated as a logged-in user
    user_id = a.user.identity.id if a.user and a.user.identity else None
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

# Helper: Create P2P message headers
def headers(from_id, to_id, event):
    return {"from": from_id, "to": to_id, "service": "repositories", "event": event}

# Action: Search for repositories
# Supports: name search, entity ID, fingerprint (with/without hyphens), URL
def action_search(a):
    if not a.user or not a.user.identity:
        return a.error(401, "Not logged in")

    search = a.input("search", "").strip()
    if not search:
        # Return empty results for empty search instead of error
        return a.json({"results": []})

    results = []

    # Check if search contains /repositories/ - delegate to probe
    if "/repositories/" in search:
        return action_probe(a)

    # Strip hyphens for fingerprint matching
    clean = search.replace("-", "")

    # Check if search term is an entity ID (50-51 chars base58)
    if mochi.valid(search, "entity"):
        entry = mochi.directory.get(search)
        if entry and entry.get("class") == "repository":
            results.append(entry)

    # Check if search term is a fingerprint (9 chars base58)
    if mochi.valid(clean, "fingerprint"):
        # Search directory by fingerprint
        all_repos = mochi.directory.search("repository", "", False)
        for entry in all_repos:
            entry_fp = entry.get("fingerprint", "").replace("-", "")
            if entry_fp == clean:
                # Avoid duplicates if already found by ID
                found = False
                for r in results:
                    if r.get("id") == entry.get("id"):
                        found = True
                        break
                if not found:
                    results.append(entry)
                break

    # Also search by name
    name_results = mochi.directory.search("repository", search, False)
    for entry in name_results:
        # Avoid duplicates
        found = False
        for r in results:
            if r.get("id") == entry.get("id"):
                found = True
                break
        if not found:
            results.append(entry)

    # Extract peer ID from location field and add as server field
    for result in results:
        location = result.get("location", "")
        if location.startswith("p2p/"):
            result["server"] = location[4:]  # Strip "p2p/" prefix

    return {"data": {"results": results}}

# Action: Probe a remote repository by URL
def action_probe(a):
    if not a.user or not a.user.identity:
        return a.error(401, "Not logged in")

    url = a.input("url") or a.input("search", "")
    if not url:
        return a.error(400, "No URL provided")

    # Parse URL to extract server and repository ID
    # Expected formats:
    #   https://example.com/repositories/ENTITY_ID
    #   http://example.com/repositories/ENTITY_ID
    #   example.com/repositories/ENTITY_ID
    server = ""
    repo_id = ""
    protocol = "https://"

    # Extract and preserve protocol prefix
    if url.startswith("https://"):
        protocol = "https://"
        url = url[8:]
    elif url.startswith("http://"):
        protocol = "http://"
        url = url[7:]

    # Split by /repositories/ to get server and repo ID/fingerprint
    if "/repositories/" in url:
        parts = url.split("/repositories/", 1)
        server = protocol + parts[0]
        # Repo ID is everything after /repositories/ up to next / or end
        repo_path = parts[1]
        if "/" in repo_path:
            repo_id = repo_path.split("/")[0]
        else:
            repo_id = repo_path
    else:
        return a.error(400, "Invalid URL format. Expected: https://server/repositories/REPO_ID")

    if not server or server == protocol:
        return a.error(400, "Could not extract server from URL")

    # Check if it's a fingerprint (9 chars) or entity ID (50-51 chars)
    is_fingerprint = mochi.valid(repo_id, "fingerprint")
    is_entity_id = mochi.valid(repo_id, "entity")

    if not is_fingerprint and not is_entity_id:
        return a.error(400, "Invalid repository ID or fingerprint in URL")

    # If it's a fingerprint, try to resolve to entity ID via directory or server
    if is_fingerprint:
        # Try directory first
        all_repos = mochi.directory.search("repository", "", False)
        for entry in all_repos:
            if entry.get("fingerprint", "").replace("-", "") == repo_id.replace("-", ""):
                repo_id = entry.get("id")
                break

        # If still not found, we'll try the remote request with fingerprint
        # The remote server should handle fingerprint resolution

    peer = mochi.remote.peer(server) if server and server.startswith("http") else None
    if not peer:
        return a.error(502, "Unable to connect to server")

    response = mochi.remote.request(repo_id, "repositories", "info", {"repository": repo_id}, peer)
    if response.get("error"):
        return a.error(response.get("code", 404), response["error"])

    # Return repository info as a directory-like entry in results array format
    return {"data": {"results": [{
        "id": repo_id,
        "name": response.get("name", ""),
        "description": response.get("description", ""),
        "fingerprint": response.get("fingerprint", ""),
        "class": "repository",
        "server": server,
        "remote": True
    }]}}

# Action: Subscribe to a remote repository
def action_subscribe(a):
    if not a.user or not a.user.identity:
        return a.error(401, "Not logged in")
    user_id = a.user.identity.id

    repo_id = a.input("repository")
    server = a.input("server", "")

    if not mochi.valid(repo_id, "entity"):
        return a.error(400, "Invalid repository ID")

    # Check if already subscribed
    existing = mochi.db.row("select * from repositories where id = ?", repo_id)
    if existing:
        return a.error(400, "Already subscribed to this repository")

    # If no server provided, try to discover it from directory
    if not server:
        directory = mochi.directory.get(repo_id)
        if directory:
            # Get peer ID from location field (format: "p2p/PEER_ID")
            location = directory.get("location", "")
            if location.startswith("p2p/"):
                peer_id = location[4:]  # Strip "p2p/" prefix
                # Store peer ID in server field for P2P communication
                # mochi.remote.peer() will resolve the peer ID to connection
                server = peer_id

    # Get repository info from remote or directory
    if server:
        # If server is a URL, resolve to peer; if peer ID, pass None for directory lookup
        peer = mochi.remote.peer(server) if server.startswith("http") else None
        response = mochi.remote.request(repo_id, "repositories", "info", {"repository": repo_id}, peer)
        if response.get("error"):
            return a.error(response.get("code", 502), response.get("error", "Unable to connect to server"))
        repo_name = response.get("name", "")
        repo_description = response.get("description", "")
        repo_fingerprint = response.get("fingerprint", "")
        default_branch = response.get("default_branch", "main")
    else:
        # Use directory lookup when no server specified
        directory = mochi.directory.get(repo_id)
        if not directory:
            return a.error(404, "Unable to find repository in directory. Please provide the repository URL.")
        repo_name = directory.get("name", "")
        repo_description = ""
        repo_fingerprint = mochi.entity.fingerprint(repo_id)
        default_branch = "main"
        # For directory-only subscriptions, server will be empty
        # This means git operations won't work, only basic metadata

    # Store locally with owner=0 (subscribed)
    now = mochi.time.now()
    mochi.db.execute("""
        insert into repositories (id, name, description, default_branch, owner, server, created, updated)
        values (?, ?, ?, ?, 0, ?, ?, ?)
    """, repo_id, repo_name, repo_description, default_branch, server or "", now, now)

    # Notify remote owner
    mochi.message.send(headers(user_id, repo_id, "subscribe"), {"name": a.user.identity.name})

    return a.json({"fingerprint": repo_fingerprint, "name": repo_name})

# Action: Unsubscribe from a remote repository
def action_unsubscribe(a):
    if not a.user or not a.user.identity:
        return a.error(401, "Not logged in")
    user_id = a.user.identity.id

    repo_id = a.input("repository")
    if not mochi.valid(repo_id, "entity") and not mochi.valid(repo_id, "fingerprint"):
        return a.error(400, "Invalid repository ID")

    # Get repository
    repo = mochi.db.row("select * from repositories where id = ?", repo_id)
    if not repo:
        # Try by fingerprint
        repos = mochi.db.rows("select * from repositories")
        for r in repos:
            if mochi.entity.fingerprint(r["id"]) == repo_id:
                repo = r
                repo_id = r["id"]
                break
    if not repo:
        return a.error(404, "Repository not found")

    if repo["owner"] == 1:
        return a.error(400, "Cannot unsubscribe from owned repository")

    # Delete local reference
    mochi.db.execute("delete from repositories where id = ?", repo_id)

    # Notify remote owner
    mochi.message.send(headers(user_id, repo_id, "unsubscribe"), {})

    return a.json({"success": True})

# EVENT HANDLERS

# Handle info request from remote server (stream-based)
def event_info(e):
    repo_id = e.header("to")

    # Get entity info
    entity = mochi.entity.info(repo_id)
    if not entity or entity.get("class") != "repository":
        e.stream.write({"error": "Repository not found", "code": 404})
        return

    # Get repository details from database
    repo = mochi.db.row("select * from repositories where id = ?", repo_id)
    if not repo:
        e.stream.write({"error": "Repository not found", "code": 404})
        return

    # Check read access for the requester
    requester = e.header("from")
    if not mochi.access.check(requester, "repo/" + repo_id, "read"):
        e.stream.write({"error": "Access denied", "code": 403})
        return

    e.stream.write({
        "id": repo["id"],
        "name": repo["name"],
        "description": repo["description"],
        "default_branch": repo["default_branch"],
        "fingerprint": mochi.entity.fingerprint(repo_id),
    })

# Handle incoming subscription
def event_subscribe(e):
    repo_id = e.header("to")
    subscriber_id = e.header("from")
    name = e.content("name", "")

    # Verify repository exists and we own it
    repo = mochi.db.row("select * from repositories where id = ? and owner = 1", repo_id)
    if not repo:
        return

    # Add to subscribers table
    now = mochi.time.now()
    mochi.db.execute("""
        replace into subscribers (repository, id, name, subscribed)
        values (?, ?, ?, ?)
    """, repo_id, subscriber_id, name, now)

# Handle unsubscription
def event_unsubscribe(e):
    repo_id = e.header("to")
    subscriber_id = e.header("from")

    # Remove from subscribers
    mochi.db.execute("delete from subscribers where repository = ? and id = ?", repo_id, subscriber_id)

# Handle metadata update from remote repository owner
def event_update(e):
    repo_id = e.header("from")

    # Only update if we have this as a subscribed repository
    repo = mochi.db.row("select * from repositories where id = ? and owner = 0", repo_id)
    if not repo:
        return

    name = e.content("name")
    description = e.content("description")
    default_branch = e.content("default_branch")

    updates = []
    params = []

    if name:
        updates.append("name = ?")
        params.append(name)
    if description:
        updates.append("description = ?")
        params.append(description)
    if default_branch:
        updates.append("default_branch = ?")
        params.append(default_branch)

    if updates:
        updates.append("updated = ?")
        params.append(mochi.time.now())
        params.append(repo_id)
        mochi.db.execute("update repositories set " + ", ".join(updates) + " where id = ?", *params)

# Handle activity notification from remote (push, branch, tag)
def event_activity(e):
    repo_id = e.header("from")

    # Only update if we have this as a subscribed repository
    repo = mochi.db.row("select * from repositories where id = ? and owner = 0", repo_id)
    if not repo:
        return

    # Update timestamp
    mochi.db.execute("update repositories set updated = ? where id = ?", mochi.time.now(), repo_id)

# Handle notification that a repository has been deleted by its owner
def event_deleted(e):
    repo_id = e.header("from")

    # Delete local subscription
    mochi.db.execute("delete from repositories where id = ? and owner = 0", repo_id)

# Handle P2P request for repository refs
def event_refs(e):
    repo_id = e.header("to")
    requester = e.header("from")

    # Verify repository exists and we own it
    repo = mochi.db.row("select * from repositories where id = ? and owner = 1", repo_id)
    if not repo:
        e.stream.write({"error": "Repository not found", "code": 404})
        return

    # Check read access
    if not mochi.access.check(requester, "repo/" + repo_id, "read"):
        e.stream.write({"error": "Access denied", "code": 403})
        return

    # Get refs
    refs = mochi.git.refs(repo_id)
    e.stream.write({"refs": refs or []})

# Handle P2P request for repository branches
def event_branches(e):
    repo_id = e.header("to")
    requester = e.header("from")

    # Verify repository exists and we own it
    repo = mochi.db.row("select * from repositories where id = ? and owner = 1", repo_id)
    if not repo:
        e.stream.write({"error": "Repository not found", "code": 404})
        return

    # Check read access
    if not mochi.access.check(requester, "repo/" + repo_id, "read"):
        e.stream.write({"error": "Access denied", "code": 403})
        return

    # Get branches
    branches = mochi.git.branches(repo_id)
    default = mochi.git.branch.default.get(repo_id)
    e.stream.write({"branches": branches or [], "default": default})

# Handle P2P request for repository tags
def event_tags(e):
    repo_id = e.header("to")
    requester = e.header("from")

    # Verify repository exists and we own it
    repo = mochi.db.row("select * from repositories where id = ? and owner = 1", repo_id)
    if not repo:
        e.stream.write({"error": "Repository not found", "code": 404})
        return

    # Check read access
    if not mochi.access.check(requester, "repo/" + repo_id, "read"):
        e.stream.write({"error": "Access denied", "code": 403})
        return

    # Get tags
    tags = mochi.git.tags(repo_id)
    e.stream.write({"tags": tags or []})

# Handle P2P request for repository commits
def event_commits(e):
    repo_id = e.header("to")
    requester = e.header("from")

    # Verify repository exists and we own it
    repo = mochi.db.row("select * from repositories where id = ? and owner = 1", repo_id)
    if not repo:
        e.stream.write({"error": "Repository not found", "code": 404})
        return

    # Check read access
    if not mochi.access.check(requester, "repo/" + repo_id, "read"):
        e.stream.write({"error": "Access denied", "code": 403})
        return

    # Get parameters
    ref = e.content("ref", "")
    if not ref:
        ref = repo.get("default_branch", "main")

    # Get commits
    commits = mochi.git.commits(repo_id, ref)
    e.stream.write({"ref": ref, "commits": commits or []})

# Handle P2P request for repository tree
def event_tree(e):
    repo_id = e.header("to")
    requester = e.header("from")

    # Verify repository exists and we own it
    repo = mochi.db.row("select * from repositories where id = ? and owner = 1", repo_id)
    if not repo:
        e.stream.write({"error": "Repository not found", "code": 404})
        return

    # Check read access
    if not mochi.access.check(requester, "repo/" + repo_id, "read"):
        e.stream.write({"error": "Access denied", "code": 403})
        return

    # Get parameters
    ref = e.content("ref", "")
    if not ref:
        ref = repo.get("default_branch", "main")
    path = e.content("path", "")

    # Get tree entries
    entries = mochi.git.tree(repo_id, ref, path)
    e.stream.write({"ref": ref, "path": path, "entries": entries or []})

# Handle P2P request for repository blob
def event_blob(e):
    repo_id = e.header("to")
    requester = e.header("from")

    # Verify repository exists and we own it
    repo = mochi.db.row("select * from repositories where id = ? and owner = 1", repo_id)
    if not repo:
        e.stream.write({"error": "Repository not found", "code": 404})
        return

    # Check read access
    if not mochi.access.check(requester, "repo/" + repo_id, "read"):
        e.stream.write({"error": "Access denied", "code": 403})
        return

    # Get parameters
    ref = e.content("ref", "")
    if not ref:
        ref = repo.get("default_branch", "main")
    path = e.content("path", "")

    # Get blob metadata
    blob = mochi.git.blob.get(repo_id, ref, path)
    if not blob:
        e.stream.write({"error": "File not found", "code": 404})
        return

    # For small non-binary files, include content
    content = None
    if not blob.get("binary", False) and blob.get("size", 0) < 1024 * 1024:
        content = mochi.git.blob.content(repo_id, ref, path)

    e.stream.write({
        "ref": ref,
        "path": path,
        "sha": blob.get("sha", ""),
        "size": blob.get("size", 0),
        "binary": blob.get("binary", False),
        "content": content,
    })

# BROADCAST FUNCTIONS (for sending updates to subscribers)

# Broadcast metadata update to all subscribers
def broadcast_update(repo):
    subscribers = mochi.db.rows("select id from subscribers where repository = ?", repo["id"])
    for sub in subscribers:
        mochi.message.send(
            headers(repo["id"], sub["id"], "update"),
            {"name": repo["name"], "description": repo["description"], "default_branch": repo["default_branch"]}
        )

# Broadcast activity notification to all subscribers
def broadcast_activity(repo, activity_type, details):
    subscribers = mochi.db.rows("select id from subscribers where repository = ?", repo["id"])
    for sub in subscribers:
        mochi.message.send(
            headers(repo["id"], sub["id"], "activity"),
            {"type": activity_type, "details": details}
        )

# Broadcast deletion notification to all subscribers
def broadcast_deleted(repo):
    subscribers = mochi.db.rows("select id from subscribers where repository = ?", repo["id"])
    for sub in subscribers:
        mochi.message.send(
            headers(repo["id"], sub["id"], "deleted"),
            {}
        )
