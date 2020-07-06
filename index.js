const express = require('express')
const path = require('path')
const PORT = process.env.PORT || 5000
const bodyParser = require('body-parser');

const pg = require('pg');

const uuid = require('uuid');

const configfile = require('./config');
const line = require('@line/bot-sdk');

const dialogflow = require('dialogflow');

//B
pg.defaults.ssl = true;

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
  


  .post('/webhook/', (req, res) => {
    
    try {
      req.body.events.map(handleEvent)
      
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
         break;

        default:
          throw new Error(`Unknown message: ${JSON.stringify(message)}`);
      }
      break;    

    default:
      throw new Error(`Unknown event: ${JSON.stringify(event)}`);
  }

}



async function sendToDialogFlow(sender, textString, replyToken, params) {  

  

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
  //console.log(response);
  let responseText = response.fulfillmentMessages.fulfillmentText;

  let messages = response.fulfillmentMessages;
  let action = response.action;
  let contexts = response.outputContexts;
  let parameters = response.parameters;
  console.log(JSON.stringify(responseText));
  

  if (isDefined(action)) {
      handleDialogFlowAction(sender, action, messages, contexts, parameters, replyToken);
      console.log('handleDialogFlowResponse defined action'); 
  } else if (isDefined(messages)) {
      handleMessages(messages, replyToken);//////////////////////////////////////
      console.log('handleDialogFlowResponse defined messages-if not setting action on DF');
      
  } 
}

function handleDialogFlowAction(sender, action, messages, contexts, parameters,replyToken) {
  switch (action) {    

    case 'test':
      console.log('da vao dc default case');
      addUser2DB(sender,replyToken);
      break;

    default:
      console.log('da vao dc default case');
      console.log(replyToken);   
      //console.log(JSON.stringify(messages));       
      handleMessages( messages,replyToken);
    
  }  
}


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

  console.log("da gui tin nhan ");
  return client.replyMessage(
    token,
    texts.map((text) => ({ type: 'text', text }))
  );
}

function addUser2DB(userId, replyToken){
  client.getProfile(userId)
  .then((profile) => {
    console.log(profile.displayName);
    console.log(profile.userId);
    console.log(profile.pictureUrl);
    console.log(profile.statusMessage);
    
    if (profile.displayName) {
          
      var pool = new pg.Pool(configfile.PG_CONFIG);
      pool.connect(function(err, client, done) {
          if (err) {
              return console.error('Error acquiring client', err.stack);
          }
          var rows = [];
          client.query(`SELECT line_userid FROM users_line WHERE line_userid='${userId}' LIMIT 1`,
              function(err, result) {
                  if (err) {
                      console.log('Query error: ' + err);
                  } else {
                      if (result.rows.length === 0) {
                          let sql = 'INSERT INTO users_line (line_userid, displayname, pictureurl, statusmessage) ' +
                              'VALUES ($1, $2, $3, $4)';
                          client.query(sql,
                              [
                                  userId,
                                  profile.displayName,
                                  profile.pictureUrl,
                                  profile.statusMessage
                              ]);
                      }
                  }
              });
          
      });
      pool.end();
      
      sendTextMessage(replyToken,"da xong");
      
    } 
  })
  .catch((err) => {
    // error handling
    //console.log(err);
  });


  

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