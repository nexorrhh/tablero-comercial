// Comentarios por lead (CLAUDE.md §4 `comments`).

import { gateway } from '../../lib/gateway.js';
import { COLLECTIONS, COMMENT_PARENT_TYPE } from '../../lib/collections.js';

export async function loadComments(parentId, parentType = COMMENT_PARENT_TYPE.LEAD) {
  const [comments, users] = await Promise.all([
    gateway.list(COLLECTIONS.COMMENTS, {
      filter: { parent_id: parentId, parent_type: parentType },
      sort: { field: 'created_at', direction: 'desc' },
    }),
    gateway.list(COLLECTIONS.USERS),
  ]);
  const usersById = new Map(users.map((u) => [u.id, u]));
  return comments.map((c) => ({
    ...c,
    userName: usersById.get(c.user_id) ? `${usersById.get(c.user_id).first_name} ${usersById.get(c.user_id).last_name}` : '—',
  }));
}

export async function addComment(parentId, userId, body, parentType = COMMENT_PARENT_TYPE.LEAD) {
  return gateway.create(COLLECTIONS.COMMENTS, { parent_type: parentType, parent_id: parentId, user_id: userId, body });
}
