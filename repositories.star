# Mochi Repositories app
# Copyright Alistair Cunningham 2025-2026

# Database schema
def database_create():
    mochi.db.execute("""
        create table repositories (
            id text primary key not null,
            name text not null default '',
            path text not null default '',
            description text not null default '',
            default_branch text not null default 'main',
            size integer not null default 0,
            owner integer not null default 1,
            server text not null default '',
            fingerprint text not null default '',
            created text not null default '',
            updated text not null default ''
        )
    """)
    mochi.db.execute("create index repositories_name on repositories(name)")
    mochi.db.execute("create index repositories_path on repositories(path)")
    mochi.db.execute("create index repositories_owner on repositories(owner)")
    mochi.db.execute("create index repositories_fingerprint on repositories(fingerprint)")

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
    if version == 8:
        # Rename the access namespace from "repo/" to "repository/" so resource
        # keys match the rest of the app's vocabulary (class "repository", URL
        # path :repository, etc). The access table lives in the app system db,
        # which Starlark can only reach via mochi.access.* — so iterate every
        # known repo, copy its rules under the new key, then drop the old ones.
        repos = mochi.db.rows("select id from repositories") or []
        for repo in repos:
            old = "repo/" + repo["id"]
            new = "repository/" + repo["id"]
            for rule in mochi.access.list.resource(old) or []:
                granter = rule.get("granter") or ""
                if rule.get("grant"):
                    mochi.access.allow(rule["subject"], new, rule["operation"], granter)
                else:
                    mochi.access.deny(rule["subject"], new, rule["operation"], granter)
            mochi.access.clear.resource(old)

# Validate git SHA: 4-40 hex characters
def valid_sha(s):
    if len(s) < 4 or len(s) > 40:
        return False
    for c in s.elems():
        if c not in "0123456789abcdefABCDEF":
            return False
    return True

# Validate path: lowercase alphanumeric + hyphens, 1-100 chars, no leading/trailing hyphens
def valid_path(p):
    if len(p) < 1 or len(p) > 100:
        return False
    allowed = "abcdefghijklmnopqrstuvwxyz0123456789-"
    for c in p.elems():
        if c not in allowed:
            return False
    if p[0] == "-" or p[-1] == "-":
        return False
    return True

# Validate git ref: alphanumeric, hyphens, dots, slashes, underscores, 1-256 chars
def valid_ref(r):
    if len(r) < 1 or len(r) > 256:
        return False
    allowed = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-._/"
    for c in r.elems():
        if c not in allowed:
            return False
    if ".." in r:
        return False
    return True

# Resolve a ref and file path from a combined path like "feature/hello-world/src/main.ts".
# Tries progressively longer prefixes as git refs until one matches.
def resolve_ref(repo_id, combined):
    if not combined:
        return ("HEAD", "")
    parts = combined.split("/")
    for i in range(1, len(parts) + 1):
        candidate = "/".join(parts[:i])
        if not valid_ref(candidate):
            continue
        root = mochi.git.tree(repo_id, candidate, "")
        if root != None:
            return (candidate, "/".join(parts[i:]))
    # No valid ref found; return full path as ref (will produce a proper error later)
    return (combined, "")

# Action: Get class info - returns list of repositories for class context
def action_info_class(a):
    is_logged_in = a.user and a.user.identity
    if is_logged_in:
        # Logged-in users see all repositories (owned + subscribed)
        repos = mochi.db.rows("select id, name, path, description, default_branch, size, owner, server, created, updated from repositories order by name")
    else:
        # Anonymous users see only local repositories with public read access
        repos = mochi.db.rows("select id, name, path, description, default_branch, size, owner, server, created, updated from repositories where owner=1 order by name")
        if repos:
            visible = []
            for repo in repos:
                if mochi.access.check(None, "repository/" + repo["id"], "read"):
                    visible.append(repo)
            repos = visible

    # Add fingerprint to each repository
    if repos:
        for repo in repos:
            repo["fingerprint"] = mochi.entity.fingerprint(repo["id"])

    return {"data": {"entity": False, "repositories": repos or []}}

# Helper: Get repository from route parameter
# Route parameter may be fingerprint or entity ID - resolve to entity ID first
def get_repo(a):
    repo_param = a.input("repository")
    if not repo_param:
        return None

    # First try to find directly by ID
    repo = mochi.db.row("select * from repositories where id = ?", repo_param)
    if repo:
        return repo

    # Try to find by fingerprint
    repo = mochi.db.row("select * from repositories where fingerprint = ?", repo_param)
    return repo

# Action: Get entity info - returns repository details for entity context
def action_info_entity(a):
    repo = get_repo(a)
    if not repo:
        return a.error(404, "Repository not found")

    # Check if this is a subscribed remote repository
    is_remote = repo.get("owner", 1) == 0
    server = repo.get("server", "")

    if is_remote:
        # Fetch live data from remote server (peer=None uses directory lookup)
        peer = mochi.remote.peer(server) if server else None
        response = mochi.remote.request(repo["id"], "repositories", "info", {"repository": repo["id"]}, peer)
        if not response.get("error"):
            # Update cached data
            mochi.db.execute("""
                update repositories set name = ?, path = ?, description = ?, default_branch = ?, updated = ?
                where id = ?
            """, response.get("name", repo["name"]),
                response.get("path", repo.get("path", "")),
                response.get("description", repo["description"]),
                response.get("default_branch", repo["default_branch"]),
                mochi.time.now(), repo["id"])

            return {"data": {
                "entity": True,
                "id": repo["id"],
                "fingerprint": response.get("fingerprint", mochi.entity.fingerprint(repo["id"])),
                "name": response.get("name", repo["name"]),
                "path": response.get("path", repo.get("path", "")),
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
            "path": repo.get("path", ""),
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
    access = mochi.access.list.resource("repository/" + repo["id"])
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
        "path": repo.get("path", ""),
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
    path = a.input("path", "")
    description = a.input("description", "")
    allow_read = a.input("allow_read", "true") != "false"
    privacy = a.input("privacy", "public")

    if not name:
        return a.error(400, "Name is required")

    if len(name) > 100:
        return a.error(400, "Name is too long (max 100 characters)")

    if not path:
        return a.error(400, "Path is required")

    if not valid_path(path):
        return a.error(400, "Path must be lowercase letters, numbers, and hyphens (1-100 chars, no leading/trailing hyphens)")

    if description and len(description) > 2000:
        return a.error(400, "Description is too long (max 2000 characters)")

    # Check for duplicate name
    existing = mochi.db.row("select id from repositories where name = ?", name)
    if existing:
        return a.error(400, "A repository with that name already exists")

    # Check for duplicate path
    existing_path = mochi.db.row("select id from repositories where path = ?", path)
    if existing_path:
        return a.error(400, "A repository with that path already exists")

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
    fp = mochi.entity.fingerprint(entity_id) or ""
    mochi.db.execute("""
        insert into repositories (id, name, path, description, default_branch, fingerprint, created, updated)
        values (?, ?, ?, ?, 'main', ?, ?, ?)
    """, entity_id, name, path, description, fp, now, now)

    # Set up access control
    if a.user and a.user.identity:
        mochi.access.allow(a.user.identity.id, "repository/" + entity_id, "*", a.user.identity.id)

    # Public read access (allow anyone to read)
    if allow_read:
        mochi.access.allow("*", "repository/" + entity_id, "read", a.user.identity.id if a.user else "")

    fingerprint = mochi.entity.fingerprint(entity_id)
    return {"data": {"id": entity_id, "fingerprint": fingerprint, "name": name, "path": path, "url": "/" + fingerprint}}

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

    return {"data": {
        "id": repo["id"],
        "name": row["name"],
        "path": row.get("path", ""),
        "description": row["description"],
        "default_branch": row["default_branch"],
    }}

# Action: Update repository settings
def action_settings_set(a):
    repo = get_repo(a)
    if not repo:
        return a.error(404, "Repository not found")

    if not check_write_access(a, repo["id"]):
        return a.error(403, "Access denied")

    path = a.input("path")
    description = a.input("description")
    default_branch = a.input("default_branch")
    allow_read = a.input("allow_read")
    privacy = a.input("privacy")

    if description and len(description) > 2000:
        return a.error(400, "Description is too long (max 2000 characters)")

    updates = []
    params = []

    if path:
        if not valid_path(path):
            return a.error(400, "Path must be lowercase letters, numbers, and hyphens (1-100 chars, no leading/trailing hyphens)")
        existing = mochi.db.row("select id from repositories where path = ? and id != ?", path, repo["id"])
        if existing:
            return a.error(400, "A repository with that path already exists")
        updates.append("path = ?")
        params.append(path)

    if a.input("description") != None:
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
        mochi.access.allow("*", "repository/" + repo["id"], "read", owner_id)
    elif allow_read == "false":
        mochi.access.deny("*", "repository/" + repo["id"], "read", owner_id)

    # Update entity privacy (directory listing)
    if privacy in ["public", "private"]:
        mochi.entity.update(repo["id"], privacy=privacy)

    return {"data": {"success": True}}

# Action: Rename repository
def action_rename(a):
    repo = get_repo(a)
    if not repo:
        return a.error(404, "Repository not found")

    if not check_admin_access(a, repo["id"]):
        return a.error(403, "Access denied")

    name = a.input("name")
    if not name or not mochi.valid(name, "name"):
        return a.error(400, "Invalid name")

    if len(name) > 100:
        return a.error(400, "Name is too long (max 100 characters)")

    # Update entity (handles directory, network publishing)
    mochi.entity.update(repo["id"], name=name)

    # Update local database
    mochi.db.execute("update repositories set name=?, updated=? where id=?", name, mochi.time.now(), repo["id"])

    # Broadcast update to subscribers
    updated_repo = mochi.db.row("select * from repositories where id=?", repo["id"])
    if updated_repo:
        broadcast_update(updated_repo)

    return {"data": {"success": True}}

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

    # Delete entity (only for owned repos - subscribed repos don't have a local entity)
    if repo.get("owner", 1) == 1:
        mochi.entity.delete(repo["id"])

    return {"data": {"success": True}}

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

    resource = "repository/" + repo["id"]
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

    return {"data": {"rules": filtered_rules}}

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

    resource = "repository/" + repo["id"]
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

    return {"data": {"success": True}}

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

    resource = "repository/" + repo["id"]

    # Remove all rules for this subject
    for op in ["read", "write", "*"]:
        mochi.access.revoke(subject, resource, op)

    return {"data": {"success": True}}

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
        # Fetch from remote server (peer=None uses directory lookup)
        peer = mochi.remote.peer(server) if server else None
        response = mochi.remote.request(repo["id"], "repositories", "refs", {"repository": repo["id"]}, peer)
        if not response.get("error"):
            return {"data": response}
        return {"data": {"refs": []}}

    # Local repository
    refs = mochi.git.refs(repo["id"])
    return {"data": {"refs": refs or []}}

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
        # Fetch from remote server (peer=None uses directory lookup)
        peer = mochi.remote.peer(server) if server else None
        response = mochi.remote.request(repo["id"], "repositories", "branches", {"repository": repo["id"]}, peer)
        if not response.get("error"):
            return {"data": response}
        return {"data": {"branches": [], "default": repo.get("default_branch", "main")}}

    # Local repository
    branches = mochi.git.branches(repo["id"])
    default = mochi.git.branch.default.get(repo["id"])

    return {"data": {
        "branches": branches or [],
        "default": default,
    }}

# Action: Create branch
def action_branch_create(a):
    repo = get_repo(a)
    if not repo:
        return a.error(404, "Repository not found")
    if not check_write_access(a, repo["id"]):
        return a.error(403, "Access denied")

    name = a.input("name", "").strip()
    source = a.input("source") or "HEAD"

    if not name:
        return a.error(400, "Branch name is required")
    if len(name) > 256:
        return a.error(400, "Branch name is too long")

    result = mochi.git.branch.create(repo["id"], name, source)
    if not result:
        return a.error(400, "Failed to create branch")

    return {"data": {"success": True, "name": name}}

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

    return {"data": {"success": True}}

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
        # Fetch from remote server (peer=None uses directory lookup)
        peer = mochi.remote.peer(server) if server else None
        response = mochi.remote.request(repo["id"], "repositories", "tags", {"repository": repo["id"]}, peer)
        if not response.get("error"):
            return {"data": response}
        return {"data": {"tags": []}}

    # Local repository
    tags = mochi.git.tags(repo["id"])
    return {"data": {"tags": tags or []}}

# Action: List commits
def action_commits(a):
    repo = get_repo(a)
    if not repo:
        return a.error(404, "Repository not found")

    if not check_read_access(a, repo["id"]):
        return a.error(403, "Access denied")

    ref = a.input("ref", "HEAD")
    if not valid_ref(ref):
        return a.error(400, "Invalid ref")
    limit_str = a.input("limit", "50")
    offset_str = a.input("offset", "0")
    if not limit_str.isdigit() or not offset_str.isdigit():
        return a.error(400, "Invalid pagination parameters")
    limit = int(limit_str)
    offset = int(offset_str)
    if limit < 1 or limit > 1000:
        limit = 50
    if offset < 0:
        offset = 0

    # Check if remote repository
    is_remote = repo.get("owner", 1) == 0
    server = repo.get("server", "")

    if is_remote:
        # Fetch from remote server (peer=None uses directory lookup)
        peer = mochi.remote.peer(server) if server else None
        response = mochi.remote.request(repo["id"], "repositories", "commits", {
            "repository": repo["id"],
            "ref": ref,
            "limit": str(limit),
            "offset": str(offset)
        }, peer)
        if not response.get("error"):
            return {"data": response}
        return {"data": {"commits": []}}

    # Local repository
    commits = mochi.git.commit.list(repo["id"], ref, limit, offset)
    if commits == None:
        # Check if repository is empty (no branches or tags at all)
        branches = mochi.git.branches(repo["id"])
        tags = mochi.git.tags(repo["id"])
        if (not branches or len(branches) == 0) and (not tags or len(tags) == 0):
            return {"data": {"commits": []}}
        return a.error(404, "Branch or tag '%s' not found." % ref)
    return {"data": {"commits": commits or []}}

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

    if not valid_sha(sha):
        return a.error(400, "Invalid commit SHA")

    # Check if remote repository
    is_remote = repo.get("owner", 1) == 0
    server = repo.get("server", "")

    if is_remote:
        peer = mochi.remote.peer(server) if server else None
        response = mochi.remote.request(repo["id"], "repositories", "commit", {
            "repository": repo["id"],
            "sha": sha
        }, peer)
        if not response.get("error"):
            return {"data": response}
        return a.error(404, "Commit not found")

    commit = mochi.git.commit.get(repo["id"], sha)
    if not commit:
        return a.error(404, "Commit not found")

    return {"data": {"commit": commit}}

# Action: Browse tree
def action_tree(a):
    repo = get_repo(a)
    if not repo:
        return a.error(404, "Repository not found")

    if not check_read_access(a, repo["id"]):
        return a.error(403, "Access denied")

    is_remote = repo.get("owner", 1) == 0
    server = repo.get("server", "")

    # Parse ref and path: catch-all "treepath" contains both, resolve which part is the ref
    treepath = a.input("treepath", "")
    if treepath:
        if is_remote:
            parts = treepath.split("/", 1)
            ref = parts[0] if parts[0] else "HEAD"
            path = parts[1] if len(parts) > 1 else ""
        else:
            ref, path = resolve_ref(repo["id"], treepath)
    else:
        ref = a.input("ref", "HEAD")
        path = a.input("path", "")

    if not valid_ref(ref):
        return a.error(400, "Invalid ref")

    if is_remote:
        # Fetch from remote server
        peer = mochi.remote.peer(server) if server else None
        response = mochi.remote.request(repo["id"], "repositories", "tree", {
            "repository": repo["id"],
            "ref": ref,
            "path": path
        }, peer)
        if not response.get("error"):
            return {"data": response}
        # Fall through to return empty/error if remote unavailable
        return {"data": {"ref": ref, "path": path, "entries": []}}

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
            return {"data": {
                "ref": ref,
                "path": path,
                "entries": [],
            }}
        return a.error(404, "Branch or tag '%s' not found." % ref)

    return {"data": {
        "ref": ref,
        "path": path,
        "entries": tree or [],
    }}

# Action: Get blob content
def action_blob(a):
    repo = get_repo(a)
    if not repo:
        return a.error(404, "Repository not found")

    if not check_read_access(a, repo["id"]):
        return a.error(403, "Access denied")

    is_remote = repo.get("owner", 1) == 0
    server = repo.get("server", "")

    # Parse ref and path: catch-all "blobpath" contains both
    blobpath = a.input("blobpath", "")
    if blobpath:
        if is_remote:
            parts = blobpath.split("/", 1)
            ref = parts[0] if parts[0] else "HEAD"
            path = parts[1] if len(parts) > 1 else ""
        else:
            ref, path = resolve_ref(repo["id"], blobpath)
    else:
        ref = a.input("ref", "HEAD")
        path = a.input("path", "")

    if not valid_ref(ref):
        return a.error(400, "Invalid ref")

    if not path:
        return a.error(400, "Path is required")

    if is_remote:
        # Fetch from remote server
        peer = mochi.remote.peer(server) if server else None
        response = mochi.remote.request(repo["id"], "repositories", "blob", {
            "repository": repo["id"],
            "ref": ref,
            "path": path
        }, peer)
        if not response.get("error"):
            return {"data": response}
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

    return {"data": {
        "ref": ref,
        "path": path,
        "sha": blob.get("sha", ""),
        "size": blob.get("size", 0),
        "binary": blob.get("binary", False),
        "content": content,
    }}

# Action: Download repository archive (zip, tar.gz, tar.bz2)
def action_archive(a):
    repo = get_repo(a)
    if not repo:
        return a.error(404, "Repository not found")

    if not check_read_access(a, repo["id"]):
        return a.error(403, "Access denied")

    format = a.input("format", "")
    if format not in ["zip", "tar.gz", "tar.bz2"]:
        return a.error(400, "Format must be zip, tar.gz, or tar.bz2")

    ref = a.input("ref", "HEAD")
    if not valid_ref(ref):
        return a.error(400, "Invalid ref")

    content_types = {
        "zip": "application/zip",
        "tar.gz": "application/gzip",
        "tar.bz2": "application/x-bzip2",
    }

    is_remote = repo.get("owner", 1) == 0
    if is_remote:
        # Proxy to the owning peer over P2P. The peer resolves the ref, picks
        # the prefix, and streams archive bytes back; we relay the bytes to
        # the browser unchanged.
        server = repo.get("server", "")
        peer = mochi.remote.peer(server) if server else None
        s = mochi.remote.stream(repo["id"], "repositories", "archive", {
            "ref": ref,
            "format": format,
        }, peer)
        if not s:
            return a.error(503, "Failed to connect to remote server")

        # Header message: error or {filename, ...}
        head = s.read()
        if not head or head.get("error"):
            code = head.get("code", 500) if head else 502
            message = head.get("error", "Remote server unavailable") if head else "Remote server unavailable"
            return a.error(code, message)

        filename = head.get("filename", "archive.%s" % format)
        a.header("Content-Type", content_types[format])
        a.header("Content-Disposition", 'attachment; filename="%s"' % filename)
        a.write_from_stream(s)
        return None

    # Resolve ref to its tip commit so the prefix is content-addressable
    commits = mochi.git.commit.list(repo["id"], ref, 1, 0)
    if not commits:
        return a.error(404, "Branch, tag, or commit '%s' not found" % ref)
    sha = commits[0]["sha"]
    short = sha[:7]

    base = repo.get("path") or repo.get("name") or "repo"
    prefix = "%s-%s" % (base, short)
    filename = "%s.%s" % (prefix, format)

    a.header("Content-Type", content_types[format])
    a.header("Content-Disposition", 'attachment; filename="%s"' % filename)

    mochi.git.archive(repo["id"], sha, format, prefix)
    return None

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
    results = mochi.service.call("people", "users/search", query)
    return {"data": {"results": results or []}}

# Action: List groups
def action_groups(a):
    if not a.user:
        return a.error(401, "Not logged in")
    results = mochi.service.call("friends", "groups/list")
    return {"data": {"groups": results or []}}

# Action: Create a new authentication token
def action_token_create(a):
    if not a.user:
        return a.error(401, "Not logged in")

    name = (a.input("name") or "Git access").strip()
    if len(name) > 100:
        return a.error(400, "Token name is too long (max 100 characters)")
    token = mochi.token.create(name, [], 0)
    if not token:
        return a.error(500, "Failed to create token")

    return {"data": {"token": token}}

# Action: List authentication tokens
def action_token_list(a):
    if not a.user:
        return a.error(401, "Not logged in")

    tokens = mochi.token.list()
    return {"data": {"tokens": tokens or []}}

# Action: Delete authentication token
def action_token_delete(a):
    if not a.user:
        return a.error(401, "Not logged in")

    hash = a.input("hash", "").strip()
    if not hash or len(hash) > 128:
        return a.error(400, "Invalid token hash")

    ok = mochi.token.delete(hash)
    return {"data": {"ok": ok}}

# Service interface for other apps

def service_list(s, params=None):
    """List repositories owned by current user"""
    return mochi.db.rows("select id, name, description, default_branch from repositories")

def service_get(s, params=None):
    """Get repository details"""
    p = params or s
    repo_id = p.get("id", "")
    return mochi.db.row("select * from repositories where id = ?", repo_id)

def service_branches(s, params=None):
    """List branches for a repository"""
    p = params or s
    repo_id = p.get("repo", "")
    return mochi.git.branches(repo_id)

def service_file(s, params=None):
    """Get file contents at a ref"""
    p = params or s
    repo_id = p.get("repo", "")
    ref = p.get("ref", "") or "HEAD"
    path = p.get("path", "")
    return mochi.git.blob.content(repo_id, ref, path)

def service_tree(s, params=None):
    """List directory at a ref"""
    p = params or s
    repo_id = p.get("repo", "")
    ref = p.get("ref", "") or "HEAD"
    path = p.get("path", "") or ""
    return mochi.git.tree(repo_id, ref, path)

def service_commits(s, params=None):
    """List commits between two refs"""
    p = params or s
    repo_id = p.get("repo", "")
    base = p.get("base", "")
    head = p.get("head", "")
    if base and head:
        return mochi.git.commit.between(repo_id, base, head)
    return mochi.git.commit.list(repo_id, head or "HEAD", 50, 0)

def service_diff(s, params=None):
    """Get diff between refs (for PR display)"""
    p = params or s
    repo_id = p.get("repo", "")
    base = p.get("base", "")
    head = p.get("head", "")
    return mochi.git.diff(repo_id, base, head)

def service_can_merge(s, params=None):
    """Check if branches can be merged cleanly"""
    p = params or s
    repo_id = p.get("repo", "")
    source = p.get("source", "")
    target = p.get("target", "")
    return mochi.git.merge.check(repo_id, source, target)

def service_merge(s, params=None):
    """Perform merge of source branch into target branch"""
    p = params or s
    repo_id = p.get("repo", "")
    source = p.get("source", "")
    target = p.get("target", "")
    message = p.get("message", "") or "Merge branch"
    author_name = p.get("author_name", "") or "Mochi"
    author_email = p.get("author_email", "") or ""
    method = p.get("method", "") or "merge"
    return mochi.git.merge.perform(repo_id, source, target, message, author_name, author_email, method)

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
    return mochi.access.check(user_id, "repository/" + repo_id, "read")

def check_write_access(a, repo_id):
    """Check if user has write access to repository"""
    if not a.user or not a.user.identity:
        return False
    return mochi.access.check(a.user.identity.id, "repository/" + repo_id, "write")

def check_admin_access(a, repo_id):
    """Check if user has admin access to repository"""
    if not a.user or not a.user.identity:
        return False
    # Owner always has admin access
    if mochi.entity.get(repo_id):
        return True
    # Check explicit admin permission
    return mochi.access.check(a.user.identity.id, "repository/" + repo_id, "admin")

# Helper: Create P2P message headers
def headers(from_id, to_id, event):
    return {"from": from_id, "to": to_id, "service": "repositories", "event": event}

# Action: Get repository recommendations
def action_recommendations(a):
    # Gather IDs of repositories the user already has (owned or subscribed)
    existing_ids = set()
    repos = mochi.db.rows("select id from repositories")
    if repos:
        for r in repos:
            existing_ids.add(r["id"])

    # Request recommendations from the recommendations service
    s = mochi.remote.stream("1JYmMpQU7fxvTrwHpNpiwKCgUg3odWqX7s9t1cLswSMAro5M2P", "recommendations", "list", {"type": "repository", "language": "en"})
    if not s:
        return {"data": {"repositories": []}}

    r = s.read()
    if not r or r.get("status") != "200":
        return {"data": {"repositories": []}}

    recommendations = []
    items = s.read()
    if type(items) not in ["list", "tuple"]:
        return {"data": {"repositories": []}}

    # Get the server location from the recommendations entity so subscribers can reach the repositories
    rec_dir = mochi.directory.get("1JYmMpQU7fxvTrwHpNpiwKCgUg3odWqX7s9t1cLswSMAro5M2P")
    rec_server = ""
    if rec_dir:
        rec_server = rec_dir.get("location", "")

    for item in items:
        entity_id = item.get("entity", "")
        if entity_id and entity_id not in existing_ids:
            recommendations.append({
                "id": entity_id,
                "name": item.get("name", ""),
                "blurb": item.get("blurb", ""),
                "fingerprint": item.get("fingerprint", ""),
                "server": rec_server,
            })
    s.close()
    return {"data": {"repositories": recommendations}}

# Action: Search for repositories
# Supports: name search, entity ID, fingerprint (with/without hyphens), URL
def action_search(a):
    if not a.user or not a.user.identity:
        return a.error(401, "Not logged in")

    search = a.input("search", "").strip()
    if not search:
        # Return empty results for empty search instead of error
        return {"data": {"results": []}}

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
        matches = mochi.directory.search("repository", "", False, fingerprint=clean)
        for entry in matches:
            found = False
            for r in results:
                if r.get("id") == entry.get("id"):
                    found = True
                    break
            if not found:
                results.append(entry)

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

    peer = mochi.remote.peer(server) if server else None
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
        peer = mochi.remote.peer(server)
        response = mochi.remote.request(repo_id, "repositories", "info", {"repository": repo_id}, peer)
        if response.get("error"):
            return a.error(response.get("code", 502), response.get("error", "Unable to connect to server"))
        repo_name = response.get("name", "")
        repo_path = response.get("path", "")
        repo_description = response.get("description", "")
        repo_fingerprint = response.get("fingerprint", "")
        default_branch = response.get("default_branch", "main")
    else:
        # Use directory lookup when no server specified
        directory = mochi.directory.get(repo_id)
        if not directory:
            return a.error(404, "Unable to find repository in directory. Please provide the repository URL.")
        repo_name = directory.get("name", "")
        repo_path = ""
        repo_description = ""
        repo_fingerprint = mochi.entity.fingerprint(repo_id)
        default_branch = "main"
        # For directory-only subscriptions, server will be empty
        # This means git operations won't work, only basic metadata

    # Store locally with owner=0 (subscribed)
    now = mochi.time.now()
    fp = mochi.entity.fingerprint(repo_id) or ""
    mochi.db.execute("""
        insert into repositories (id, name, path, description, default_branch, owner, server, fingerprint, created, updated)
        values (?, ?, ?, ?, ?, 0, ?, ?, ?, ?)
    """, repo_id, repo_name, repo_path, repo_description, default_branch, server or "", fp, now, now)

    # Notify remote owner
    mochi.message.send(headers(user_id, repo_id, "subscribe"), {"name": a.user.identity.name})

    return {"data": {"fingerprint": repo_fingerprint, "name": repo_name}}

# Action: Unsubscribe from a remote repository
def action_unsubscribe(a):
    if not a.user or not a.user.identity:
        return a.error(401, "Not logged in")
    user_id = a.user.identity.id

    repo_id = a.input("repository")
    if not mochi.valid(repo_id, "entity") and not mochi.valid(repo_id, "fingerprint"):
        return a.error(400, "Invalid repository ID")

    # Get repository by ID or fingerprint
    repo = mochi.db.row("select * from repositories where id = ?", repo_id)
    if not repo:
        repo = mochi.db.row("select * from repositories where fingerprint = ?", repo_id)
        if repo:
            repo_id = repo["id"]
    if not repo:
        return a.error(404, "Repository not found")

    if repo["owner"] == 1:
        return a.error(400, "Cannot unsubscribe from owned repository")

    # Delete local reference
    mochi.db.execute("delete from repositories where id = ?", repo_id)

    # Notify remote owner
    mochi.message.send(headers(user_id, repo_id, "unsubscribe"), {})

    return {"data": {"success": True}}

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
    if not mochi.access.check(requester, "repository/" + repo_id, "read"):
        e.stream.write({"error": "Access denied", "code": 403})
        return

    e.stream.write({
        "id": repo["id"],
        "name": repo["name"],
        "path": repo.get("path", ""),
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
    path = e.content("path")
    description = e.content("description")
    default_branch = e.content("default_branch")

    updates = []
    params = []

    if name:
        updates.append("name = ?")
        params.append(name)
    if path:
        updates.append("path = ?")
        params.append(path)
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
    if not mochi.access.check(requester, "repository/" + repo_id, "read"):
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
    if not mochi.access.check(requester, "repository/" + repo_id, "read"):
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
    if not mochi.access.check(requester, "repository/" + repo_id, "read"):
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
    if not mochi.access.check(requester, "repository/" + repo_id, "read"):
        e.stream.write({"error": "Access denied", "code": 403})
        return

    # Get parameters
    ref = e.content("ref", "")
    if not ref:
        ref = repo.get("default_branch", "main")

    # Get commits
    commits = mochi.git.commit.list(repo_id, ref, 50, 0)
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
    if not mochi.access.check(requester, "repository/" + repo_id, "read"):
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
    if not mochi.access.check(requester, "repository/" + repo_id, "read"):
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

# Handle P2P request for a single commit
def event_commit(e):
    repo_id = e.header("to")
    requester = e.header("from")

    repo = mochi.db.row("select * from repositories where id = ? and owner = 1", repo_id)
    if not repo:
        e.stream.write({"error": "Repository not found", "code": 404})
        return

    if not mochi.access.check(requester, "repository/" + repo_id, "read"):
        e.stream.write({"error": "Access denied", "code": 403})
        return

    sha = e.content("sha", "")
    if not sha:
        e.stream.write({"error": "Commit SHA is required", "code": 400})
        return

    commit = mochi.git.commit.get(repo_id, sha)
    if not commit:
        e.stream.write({"error": "Commit not found", "code": 404})
        return

    e.stream.write({"commit": commit})

# Handle P2P request for repository archive
def event_archive(e):
    repo_id = e.header("to")
    requester = e.header("from")

    repo = mochi.db.row("select * from repositories where id = ? and owner = 1", repo_id)
    if not repo:
        e.stream.write({"error": "Repository not found", "code": 404})
        return

    if not mochi.access.check(requester, "repository/" + repo_id, "read"):
        e.stream.write({"error": "Access denied", "code": 403})
        return

    format = e.content("format", "")
    if format not in ["zip", "tar.gz", "tar.bz2"]:
        e.stream.write({"error": "Format must be zip, tar.gz, or tar.bz2", "code": 400})
        return

    ref = e.content("ref", "HEAD")
    if not valid_ref(ref):
        e.stream.write({"error": "Invalid ref", "code": 400})
        return

    commits = mochi.git.commit.list(repo_id, ref, 1, 0)
    if not commits:
        e.stream.write({"error": "Branch, tag, or commit '%s' not found" % ref, "code": 404})
        return
    sha = commits[0]["sha"]
    short = sha[:7]

    base = repo.get("path") or repo.get("name") or "repo"
    prefix = "%s-%s" % (base, short)
    filename = "%s.%s" % (prefix, format)

    # Header response, then raw archive bytes on the same stream
    e.stream.write({"filename": filename, "sha": sha, "prefix": prefix})
    mochi.git.archive(repo_id, sha, format, prefix, e.stream)

# BROADCAST FUNCTIONS (for sending updates to subscribers)

# Broadcast metadata update to all subscribers
def broadcast_update(repo):
    subscribers = mochi.db.rows("select id from subscribers where repository = ?", repo["id"])
    for sub in subscribers:
        mochi.message.send(
            headers(repo["id"], sub["id"], "update"),
            {"name": repo["name"], "path": repo.get("path", ""), "description": repo["description"], "default_branch": repo["default_branch"]}
        )

# Broadcast deletion notification to all subscribers
def broadcast_deleted(repo):
    subscribers = mochi.db.rows("select id from subscribers where repository = ?", repo["id"])
    for sub in subscribers:
        mochi.message.send(
            headers(repo["id"], sub["id"], "deleted"),
            {}
        )
