const functions = require("firebase-functions");
const admin = require('firebase-admin');
const map = require('lodash/map');
const isEmpty = require('lodash/isEmpty');

const find = require('lodash/find');

const { sendSMS } = require('./smsService');

var serviceAccount = require("./carebox-263b9-firebase-adminsdk-oxkvr-008abb4df6.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

exports.signUp = functions.https.onCall(async (data, context) => {
  const { nickName, gender, department, yearsOnJob, phoneNumber } = data;

  console.log(data);

  if(!phoneNumber || !nickName || !gender || !department){
    return {};
  }

  const number = phoneNumber.replace('0', '+82');

  try{
    let user = null;

    try{
      user = await admin.auth().createUser({displayName: nickName, phoneNumber: number});
    }catch(ex){
      user = await admin.auth().getUserByPhoneNumber(number);
      await admin.auth().updateUser(user.uid, {displayName: nickName, phoneNumber: number});
    }

    if(user !== null){
      const authToken = await admin.auth().createCustomToken(user.uid);

      await admin.firestore().collection('users').doc(user.uid).set({
          uid: user.uid, nickName, gender, department, yearsOnJob,
          authToken, grade: 1, phoneNumber,
          createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      return {uid: user.uid, authToken};
    }

  }catch(ex){
    console.log('signUp', ex);
  }
  return {};
});

function getRandomInt(min, max) {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min) + min); //The maximum is exclusive and the minimum is inclusive
}

exports.requestForVerificationCode = functions.https.onCall(async (data, context) => {
  const { phoneNumber } = data;

  console.log(phoneNumber);

  if(!phoneNumber){
    return false;
  }

  let uid = null;
  let userStatus = 'NOT_EXIST_USER';
  try{
    const user = await admin.auth().getUserByPhoneNumber(phoneNumber);
    console.log(user);
    userStatus = 'EXISTING_USER';
    uid = user.uid;
  }catch(ex){
    console.log('requestForVerificationCode', ex);
  }

  const verificationCode = phoneNumber==='+821032644404' ? '000000' : ('000000' + getRandomInt(0, 999999)).slice(-6);

  const doc = await admin.firestore().collection('verificationCodes').add({
    phoneNumber,
    userStatus,
    verificationCode,
    uid,
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });
  return {userStatus, verificationId: doc.id};
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

  console.log(idea);

  try{
    const now = admin.firestore.FieldValue.serverTimestamp();

    await admin.firestore().collection('ideas').add({
      ...idea,
      updatedAt: now,
      createdAt: now,
      isAvailable: true
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

exports.verificationCodeCreatedEvent = functions.firestore.document('verificationCodes/{verificationId}')
  .onCreate(async(snapshot, context) => {
    try{

      const { phoneNumber, verificationCode } = snapshot.data();

      // getSenderNumberList();
      sendSMS(phoneNumber, `케어박스 인증번호는 [${verificationCode}]입니다.`);
    }catch(ex){
      console.log('verificationCodeCreatedEvent', ex);
    }
  })

  exports.verifyLoginCode = functions.https.onCall(async(data, context) => {
    try{

      console.log(data);

      if(!data.verificationId || !data.verificationCode){
        return {status: 'FAIL', reason: 'request data is null', code: '1000'};
      }

      const doc = await admin.firestore().collection('verificationCodes').doc(data.verificationId).get();
      if(doc.exists){
        const {uid, verificationCode, userStatus} = doc.data();

        if(verificationCode == data.verificationCode){
          if(userStatus === 'EXISTING_USER'){
            const authToken = await admin.auth().createCustomToken(uid);
            await admin.firestore().collection('users').doc(uid).update({
              authToken,
              updatedAt: admin.firestore.FieldValue.serverTimestamp()
            })
            return {status: 'OK', uid, authToken, code: '0000'};
          }

          return {status: 'OK', code: '0001'}
        }
      }

      return {status: 'FAIL', reason: 'wrong verification', code: '2000'};
    }catch(ex){
      console.log('verifyLoginCode', ex);
      return {status: 'FAIL', reason: JSON.stringify(ex), code: '4000'};
    }
  })


  exports.userCreatedEvent = functions.firestore.document('users/{userId}')
  .onCreate(async(snapshot, context) => {
    try{
      const {userId} = context.params;

      const ret = await admin.firestore().collection('notifications')
        .where('available', '==', true)
        .where('type', '==', 'ADMIN')
        .get();

      const notifications = map(ret.docs, doc => doc.data());

      const promises = map(notifications, async notification => await admin.firestore().collection('users').doc(userId)
        .collection('notifications').add(notification));

      await Promise.all(promises);
    }catch(ex){
      console.log('userCreatedEvent', ex);
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

