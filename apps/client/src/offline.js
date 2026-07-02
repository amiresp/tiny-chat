import Dexie from 'dexie';
export const offlineDb=new Dexie('verdant-offline'); offlineDb.version(1).stores({chats:'id,updatedAt',messages:'id,chatId,createdAt,status',outbox:'clientId,chatId,createdAt,status'});
export async function cacheChats(chats){await offlineDb.chats.bulkPut(chats)} export async function cacheMessages(chatId,messages){await offlineDb.messages.where('chatId').equals(chatId).delete();await offlineDb.messages.bulkPut(messages.map(x=>({...x,chatId})))}
export async function enqueue(message){await offlineDb.outbox.put({...message,status:'queued',createdAt:Date.now()});return message} export async function queued(){return offlineDb.outbox.where('status').anyOf('queued','failed').sortBy('createdAt')}
