const popbill = require('popbill');

const LINKID = 'ZHZHXHM';
const SECRET_KEY = 'Y4Q6lJXxM/96xLCFOdWHwD9vNl9m5CZKS1UEy619hB0=';
const CORP_NUM = '4709401115';

popbill.config({
  LinkID: LINKID,
  SecretKey: SECRET_KEY,
  IsTest: true,
  defaultErrorHandler: function (Error) {
    console.log('Error Occur : [' + Error.code + '] ' + Error.message);
  }
});
const messageService = popbill.MessageService();

exports.sendSMS = async (phoneNumber, content) => {

  phoneNumber = phoneNumber.replace('+82', '0');


  const corpNum = CORP_NUM;
  const sendNum = '01088391123';
  const sendName = 'carebox';
  const receiveNum = phoneNumber;
  const receiveName = '';
  const contents = `[발신전용]\n${content}`;
  const reserveDT = '';
  const adsYN = false;
  const requestNum = "";

  await promiseSendSms(
    messageService, corpNum, sendNum, receiveNum, receiveName,
    contents, reserveDT, adsYN, sendName, requestNum
  );
};

exports.getSenderNumberList = async () => {
  messageService.getSenderNumberList(CORP_NUM, LINKID, console.log, console.log);
};

exports.sendLMS = async (phoneNumber, subject, content) => {

  popbill.config({
    LinkID: LINKID,
    SecretKey: SECRET_KEY,
    IsTest: false,
    defaultErrorHandler: function (Error) {
      console.log('Error Occur : [' + Error.code + '] ' + Error.message);
    }
  });

  phoneNumber = phoneNumber.replace('+82', '0');

  const messageService = popbill.MessageService();

  const testCorpNum = CORP_NUM;
  const sendNum = '01088391123';
  const sendName = 'carebox';
  const receiveNum = phoneNumber;
  const receiveName = '';
  const contents = `[발신전용]\n${content}`;
  const reserveDT = '';
  const adsYN = false;
  const requestNum = "";

  await promiseSendLms(
    messageService, testCorpNum, sendNum, receiveNum, receiveName,
    subject, contents, reserveDT, adsYN, sendName, requestNum);
};

function promiseSendSms(messageService, testCorpNum, sendNum, receiveNum, receiveName, contents, reserveDT, adsYN, sendName, requestNum) {
  return new Promise((resolve, reject) => {
    messageService.sendSMS(testCorpNum, sendNum, receiveNum, receiveName, contents, reserveDT, adsYN, sendName, requestNum,
      (receiptNum) => {
        console.log('success sent sms: ', receiveNum, sendNum, contents);
        resolve(receiptNum);
      }, (Error) => {
        console.error(Error.message);
        reject(Error);
      }
    );
  });
}

function promiseSendLms(messageService, testCorpNum, sendNum, receiveNum, receiveName, subject, contents, reserveDT, adsYN, sendName, requestNum) {
  return new Promise((resolve, reject) => {
    messageService.sendLMS(testCorpNum, sendNum, receiveNum, receiveName, subject, contents, reserveDT, adsYN, sendName, requestNum,
      (receiptNum) => {
        console.log('success sent sms: ', receiveNum, sendNum, contents);
        resolve(receiptNum);
      }, (Error) => {
        console.error(Error.message);
        reject(Error);
      }
    );
  });
}