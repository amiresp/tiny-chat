import express from 'express';
import { Server } from 'socket.io';
import { and, eq, inArray, ne } from 'drizzle-orm';
import { db } from './db.js';
import { chatMembers, users } from './schema.js';

const patchFlag = Symbol.for('verdant.direct-chat-patch');

function toPeer(user) {
  if (!user) return null;
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    lastSeenAt: user.lastSeenAt,
    hidePresence: user.hidePresence,
  };
}

function personalizeChat(chat, peer) {
  if (!chat || chat.type !== 'direct' || !peer) return chat;
  return {
    ...chat,
    title: peer.displayName || peer.username,
    avatarUrl: peer.avatarUrl || chat.avatarUrl || null,
    peer: toPeer(peer),
  };
}

async function getPeer(chatId, currentUserId) {
  const [peer] = await db.select({
    id: users.id,
    username: users.username,
    displayName: users.displayName,
    avatarUrl: users.avatarUrl,
    lastSeenAt: users.lastSeenAt,
    hidePresence: users.hidePresence,
  })
    .from(chatMembers)
    .innerJoin(users, eq(users.id, chatMembers.userId))
    .where(and(
      eq(chatMembers.chatId, Number(chatId)),
      ne(chatMembers.userId, Number(currentUserId)),
    ))
    .limit(1);

  return peer || null;
}

async function enrichChatList(request, payload) {
  if (!payload || !Array.isArray(payload.chats) || !request.user?.id) return payload;

  const directIds = payload.chats
    .filter((chat) => chat.type === 'direct')
    .map((chat) => Number(chat.id));

  if (!directIds.length) return payload;

  const peers = await db.select({
    chatId: chatMembers.chatId,
    id: users.id,
    username: users.username,
    displayName: users.displayName,
    avatarUrl: users.avatarUrl,
    lastSeenAt: users.lastSeenAt,
    hidePresence: users.hidePresence,
  })
    .from(chatMembers)
    .innerJoin(users, eq(users.id, chatMembers.userId))
    .where(and(
      inArray(chatMembers.chatId, directIds),
      ne(chatMembers.userId, Number(request.user.id)),
    ));

  const peerByChatId = new Map(peers.map((peer) => [Number(peer.chatId), peer]));
  return {
    ...payload,
    chats: payload.chats.map((chat) => personalizeChat(chat, peerByChatId.get(Number(chat.id)))),
  };
}

function wrapJson(response, transform, next) {
  const originalJson = response.json.bind(response);
  let transformed = false;

  response.json = (payload) => {
    if (transformed) return originalJson(payload);
    transformed = true;
    Promise.resolve(transform(payload)).then(originalJson).catch(next);
    return response;
  };
}

if (!express.application[patchFlag]) {
  express.application[patchFlag] = true;

  const originalGet = express.application.get;
  express.application.get = function patchedGet(path, ...handlers) {
    if (path === '/api/chats' && handlers.length) {
      const originalHandler = handlers.at(-1);
      handlers[handlers.length - 1] = function personalizedChatList(request, response, next) {
        wrapJson(response, (payload) => enrichChatList(request, payload), next);
        return Promise.resolve(originalHandler(request, response, next)).catch(next);
      };
    }
    return originalGet.call(this, path, ...handlers);
  };

  const originalPost = express.application.post;
  express.application.post = function patchedPost(path, ...handlers) {
    if (path === '/api/chats/direct' && handlers.length) {
      const originalHandler = handlers.at(-1);
      handlers[handlers.length - 1] = function personalizedDirectCreation(request, response, next) {
        wrapJson(response, async (payload) => {
          if (!payload?.chat) return payload;
          const peer = await getPeer(payload.chat.id, request.user?.id);
          return { ...payload, chat: personalizeChat(payload.chat, peer) };
        }, next);
        return Promise.resolve(originalHandler(request, response, next)).catch(next);
      };
    }
    return originalPost.call(this, path, ...handlers);
  };
}

if (!Server.prototype[patchFlag]) {
  Server.prototype[patchFlag] = true;
  const originalTo = Server.prototype.to;

  Server.prototype.to = function patchedTo(room) {
    const operator = originalTo.call(this, room);
    const match = typeof room === 'string' ? room.match(/^user:(\d+)$/) : null;
    if (!match) return operator;

    const currentUserId = Number(match[1]);
    const originalEmit = operator.emit.bind(operator);

    operator.emit = function personalizedEmit(event, ...args) {
      const result = originalEmit(event, ...args);
      const chat = args[0];

      if (event === 'chat:new' && chat?.type === 'direct' && !chat.title) {
        getPeer(chat.id, currentUserId)
          .then((peer) => {
            if (peer) originalEmit(event, personalizeChat(chat, peer));
          })
          .catch((error) => console.error('Failed to personalize direct chat event:', error));
      }

      return result;
    };

    return operator;
  };
}
