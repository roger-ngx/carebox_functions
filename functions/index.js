const functions = require("firebase-functions");
const admin = require('firebase-admin');
const map = require('lodash/map');
const isEmpty = require('lodash/isEmpty');

const find = require('lodash/find');

var serviceAccount = require("./carebox-263b9-firebase-adminsdk-oxkvr-008abb4df6.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

exports.signUp = functions.https.onCall(async (data, context) => {
  const { uid, nickName, gender, department, yearsOnJob, phoneNumber } = data;
  console.log(data);
  try{

    await admin.auth().updateUser(uid, {displayName: nickName})

    const authToken = await admin.auth().createCustomToken(uid);

    await admin.firestore().collection('users').doc(uid).create({
        uid, nickName, gender, department, yearsOnJob,
        authToken, grade: 1, phoneNumber,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
    })

    return {uid, authToken};
  }catch(ex){
    console.log('signUp', ex);
  }
  return {uid};
});

exports.login = functions.https.onCall(async(data, context) => {
  const { phoneNumber } = data;
  if(isEmpty(phoneNumber)) return null;

  try{
      const ret = await admin.firestore().collection('users').where('phoneNumber', '==', phoneNumber).get();
      const userDoc = find(ret.docs, doc => {
        const data = doc.data();
        return !data.leftAt;
      });

      if(userDoc){
          const uid = userDoc.id;

          if(uid){
            const authToken = await admin.auth().createCustomToken(uid);
            await admin.firestore().collection('users').doc(uid).update({
              authToken,
              updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
            return { uid, authToken };
          }
      }
  }catch(ex){
      console.log('login', ex);
  }
  return null;
});

exports.checkUserExists = functions.https.onCall(async (data, context) => {
  const { uid } = data;
  console.log(data);

  try{
    const userRecord = await admin.auth().getUser(uid);
    return {isExists: true, userRecord};
  }catch(ex){
    console.log('checkUserExists', ex);
    return { isExists: null }
  }
});

exports.checkNicknameExists = functions.https.onCall(async (data, context) => {
  const { nickName } = data;

  try{
    const result = await admin.firestore().collection('users')
                .where('nickName', '==', nickName)
                .limit(1).get();

    return { isExists: result.docs.length > 0 }
  }catch(ex){
    console.log('checkNicknameExists', ex);
    return { isExists: null }
  }
});

exports.addNewIdea = functions.https.onCall(async (data, context) => {
  const { idea } = data;
  if(!idea){
    return { ret: false}
  }

  try{
    const now = admin.firestore.FieldValue.serverTimestamp();

    await admin.firestore().collection('ideas').add({
      ...idea,
      isActive: true,
      updatedAt: now,
      createdAt: now,
    });
    return { ret: true }
  }catch(ex){
    console.log('addNewIdea', ex);
  }
  return { ret: false}
})

exports.refeshAuthToken = functions.https.onCall(async (data, context) => {
  const { uid } = data;
  if(!uid){
    return { data: false, reason: 'uid is empty' }
  }

  try{
    const authToken = await admin.auth().createCustomToken(uid);
    await admin.firestore().collection('users').doc(uid).update({
      authToken,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    })
    return { data: {uid, authToken} }
  }catch(ex){
    console.log('refeshAuthToken', ex);
    return { data: false, reason: JSON.stringify(ex) }
  }
})

exports.notificationCreatedEvent = functions.firestore.document('notifications/{notificationId}')
  .onCreate(async(snapshot, context) => {
    try{

      const notification = snapshot.data();

      const users = await admin.firestore().collection('users').get();
      const ids = map(users.docs, doc => doc.id);

      const promises = map(ids, async id => await admin.firestore().collection('users').doc(id)
        .collection('notifications').add({
          ...notification,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          unRead: true,
          type: 'ADMIN'
        }))

      await Promise.all(promises);
    }catch(ex){
      console.log('notificationCreatedEvent', ex);
    }
  })

  exports.ideaCommentCreatedEvent = functions.firestore.document('ideas/{ideaId}/comments/{commentId}')
  .onCreate(async(snapshot, context) => {
    try{
      const {ideaId, commentId} = context.params;
      const comment = snapshot.data();

      const idea = await admin.firestore().collection('ideas').doc(ideaId).get();

      await admin.firestore().collection('history').doc(comment.owner.uid)
      .collection('comments').add({
        ideaId,
        comment,
        commentId,
        idea: idea.data(),
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    }catch(ex){
      console.log('notificationCreatedEvent', ex);
    }
  })

  exports.bulletinItemCommentCreatedEvent = functions.firestore.document('bulletinBoards/{bulletinItemId}/comments/{commentId}')
  .onCreate(async(snapshot, context) => {
    try{
      const {bulletinItemId, commentId} = context.params;
      const comment = snapshot.data();

      // const bulletinItem = await admin.firestore().collection('bulletinBoards').doc(bulletinItemId).get();

      await admin.firestore().collection('history').doc(comment.owner.uid)
      .collection('bulletinComments').add({
        bulletinItemId,
        comment,
        commentId,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    }catch(ex){
      console.log('notificationCreatedEvent', ex);
    }
  })

  exports.withdrawUser = functions.https.onCall(async (data, context) => {
    const { uid } = data;
    if(!uid) return false;

    try{
      await admin.firestore().collection('users').doc(uid)
      .update({
          leftAt: admin.firestore.FieldValue.serverTimestamp(),
          nickName: 'WITHDRAWAL_USER',
          authToken: null
      })

      await admin.auth().deleteUser(uid);
      return { ret: true }
    }catch(ex){
      console.log('withdrawUser', ex);
    }
    return { ret: false }
  });

