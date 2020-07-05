const express = require('express')
const path = require('path')
const PORT = process.env.PORT || 5000
const bodyParser = require('body-parser');
var util = require('util')

const uuid = require('uuid');

const configfile = require('./config');
const line = require('@line/bot-sdk');

const dialogflow = require('dialogflow');

const middleware = require('@line/bot-sdk').middleware
const JSONParseError = require('@line/bot-sdk').JSONParseError
const SignatureValidationFailed = require('@line/bot-sdk').SignatureValidationFailed

const config = {
  channelAccessToken: configfile.linechannelAccessToken,
  channelSecret: configfile.linechannelSecret
};

// create LINE SDK client
const client = new line.Client(config);

const credentials = {
  client_email: configfile.GOOGLE_CLIENT_EMAIL,
  private_key: configfile.GOOGLE_PRIVATE_KEY
};

const sessionClient = new dialogflow.SessionsClient(
  {
      projectId: configfile.GOOGLE_PROJECT_ID,
      credentials
  }
);
const sessionIds = new Map();

express()
  .use(express.static(path.join(__dirname, 'public')))
  .use(bodyParser.json())
  

  // .post('/webhook/', (req, res) => {
  //   //console.log(util.inspect(req));
  //   Promise
  //     .all(req.body.events.map(handleEvent))
  //     .then((result) => res.json(result))
  //     .catch((err) => {
  //       console.error(err);
  //       res.status(500).end();
  //     });
  // })

  .post('/webhook/', (req, res) => {
    //console.log(util.inspect(req));
    try {
      req.body.events.map(handleEvent)
      //(result) => res.json(result)
    } catch (err) {
      console.error(err);
        res.status(500).end();
    }      
  })

  .set('views', path.join(__dirname, 'views'))
  .set('view engine', 'ejs')
  .get('/', (req, res) => res.render('pages/index'))
  .listen(PORT, () => console.log(`Listening on ${ PORT }`))



  // event handler
function handleEvent(event) {
  // if (event.type !== 'message' || event.message.type !== 'text') {
  //   // ignore non-text-message event
  //   return Promise.resolve(null);
  // }

  // create a echoing text message
  //const echo = { type: 'text', text: event.message.text };

  // use reply API
  //return client.replyMessage(event.replyToken, echo);


  if (event.replyToken && event.replyToken.match(/^(.)\1*$/)) {
    return console.log("Test hook recieved: " + JSON.stringify(event.message));
  }

  switch (event.type) {
    case 'message':
      const message = event.message;
      switch (message.type) {
        case 'text':

        
          //return handleText(message, event.replyToken, event.source);
          var senderID = event.source.userId;
          
          var timeOfMessage = event.timestamp;

          if (!sessionIds.has(senderID)) { 
            // kiểm tra xem trong cái sessionIds (là 1 map) xem là có senderID hay không.tác dụng hàm has.dấu ! tức là nếu ko có senderID
           sessionIds.set(senderID, uuid.v1());   // thì tạo 1 set mới
           }
          
          var messageText = message.text;
          if (messageText) {
            //send message to api.ai @@ gửi nó đến DialogFlow
            sendToDialogFlow(senderID, messageText,event.replyToken); 
          }

          // create a echoing text message
          //const echo = { type: 'text', text: event.message.text };

          // use reply API
          //return client.replyMessage(event.replyToken, echo);
         break;
        default:
          throw new Error(`Unknown message: ${JSON.stringify(message)}`);
      }
      break;    

    default:
      throw new Error(`Unknown event: ${JSON.stringify(event)}`);
  }

}

// function handleText(message, replyToken, source) {

// }

async function sendToDialogFlow(sender, textString, replyToken, params) {  

  //sendTypingOn(sender);//để cái chat mess hiển thị dấu ... nhấp nháy như thể ai đang gõ

  try { //try này giúp dialogFlow theo dõi cụ thể ng dùng trong cái sesion đó
      const sessionPath = sessionClient.sessionPath(
          configfile.GOOGLE_PROJECT_ID,
          sessionIds.get(sender)
      );

      // gửi văn bản tới dialogflow
      const request = {
          session: sessionPath,
          queryInput: {
              text: {
                  text: textString,
                  languageCode: configfile.DF_LANGUAGE_CODE,
              },
          },
          queryParams: {
              payload: {
                  data: params
              }
          }
      };

      // khi có phản hồi từ dialogflow thì ta xử lí nó
      const responses = await sessionClient.detectIntent(request);
      
      // đọc cái mà dialogflow gửi cho ta
      const result = responses[0].queryResult;
      handleDialogFlowResponse(sender, result, replyToken);
      
      console.log(' da vao sendToDialogFlow')
  } catch (e) {
      console.log('error');
      console.log(e);
  }

}

function handleDialogFlowResponse(sender, response, replyToken) {
  // phân tích cái mà dialogFlow gửi về
  console.log(response);
  let responseText = response.fulfillmentMessages.fulfillmentText;

  let messages = response.fulfillmentMessages;
  let action = response.action;
  let contexts = response.outputContexts;
  let parameters = response.parameters;
  console.log(JSON.stringify(responseText));
  

  //sendTypingOff(sender);

  if (isDefined(action)) {
      handleDialogFlowAction(sender, action, messages, contexts, parameters, replyToken);
      console.log('handleDialogFlowResponse defined action'); 
  } else if (isDefined(messages)) {
      handleMessages(messages, sender);
      console.log('handleDialogFlowResponse defined messages');
      
  } 
  
  // else if (responseText == '' && !isDefined(action)) {
  //     //dialogflow could not evaluate input.Nếu ko hiểu đc
  //     sendTextMessage(sender, "I'm not sure what you want. Can you be more specific?");
  //     console.log('handleDialogFlowResponse defined error dont understand ');
  // } else if (isDefined(responseText)) {
  //     sendTextMessage(sender, responseText);
  //     console.log('handleDialogFlowResponse defined responseText and send it to user ');      
  // }
}

function handleDialogFlowAction(sender, action, messages, contexts, parameters,replyToken) {
  switch (action) {    

    default:
      console.log('da vao dc default case');
      console.log(replyToken);   
      console.log(JSON.stringify(messages));       
      handleMessages( messages,replyToken);
    
  }  
}

// function handleMessages(token, texts) {
//   texts = Array.isArray(texts) ? texts : [texts];
//   return client.replyMessage(
//     token,
//     texts.map((text) => ({ type: 'text', text }))
//   );

//   //create a echoing text message
//   ///const echo = { type: 'text', text: texts };

//   //use reply API
//   //return client.replyMessage(token, echo);

// }

function handleMessages(messages, sender) {
  
  let timeoutInterval = 1100;  
  let timeout = 0;
  for (var i = 0; i < messages.length; i++) {

    if(i == messages.length - 1)  {
        
        timeout = i * timeoutInterval;
        setTimeout(handleMessage.bind(null, messages[i], sender), timeout);
        console.log('da vao handleMessages');
    }      
  }
}

function handleMessage(message, token) {
    switch (message.message) {
        case "text": //text
            console.log("da vao case text");
            
            message.text.text.forEach((text) => {
                if (text !== '') {
                    sendTextMessage(token, text);
                    console.log(text);
                }
            });
            break;        
    }
}

function sendTextMessage(token, texts) {
  texts = Array.isArray(texts) ? texts : [texts];

  console.log(texts);
  return client.replyMessage(
    token,
    texts.map((text) => ({ type: 'text', text }))
  );
}

function isDefined(obj) {
  if (typeof obj == 'undefined') {
      return false;
  }

  if (!obj) {
      return false;
  }

  return obj != null;
}