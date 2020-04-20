//Firebase backend functionalities including Authentication and Structuring the database. 

const functions = require('firebase-functions');
const app = require('express')();
const admin = require('firebase-admin'); 

admin.initializeApp();

//Intializing the firebase server
const firebaseConfig = {
    apiKey: "*****************************************",
    authDomain: "*****************************************",
    databaseURL: "*****************************************",
    projectId: "*****************************************",
    storageBucket: "*****************************************",
    messagingSenderId: "*****************************************",
    appId: "*****************************************",
    measurementId: "*****************************************"
  };

const firebase = require('firebase');
firebase.initializeApp(firebaseConfig);

const db = firebase.firestore(); 


//Routes for the Shouts
app.get('/shouts', (req, res) => {
    db
      .collection('shouts')
      .orderBy('createdAt','desc')
      .get()
      .then((data) => {
        let shouts = [];
        data.forEach((doc) => {
          shouts.push({
            shoutId: doc.id,
            body: doc.data().body,
            userHandle: doc.data().userHandle,
            createdAt: doc.data().createdAt,
            commentCount: doc.data().commentCount,
            likeCount: doc.data().likeCount
          });
        });
        return res.json(shouts);
      })
      .catch((err) => {
        console.error(err);
        res.status(500).json({ error: err.code });
      });
});

//Using Token Authorization for Middleware Authentication

const FBAuth = (req, res, next) => {
    let idToken;
    if (req.headers.authorization && 
        req.headers.authorization.startsWith('Bearer ')
        ){
      idToken = req.headers.authorization.split('Bearer ')[1];
    } else {
      console.error('No token found')
      return res.status(403).json({ error: 'Unauthorized'});
    }
  
    admin
    .auth()
    .verifyIdToken(idToken)
    .then(decodedToken => {
      req.user = decodedToken;
      console.log(decodedToken)
      return db
      .collection('users')
      .where('userId', '==', req.user.uid)
      .limit(1)
      .get();
    })
    .then(data => {
      req.user.handle = data.docs[0].data().handle;
      return next();
    })
    .catch(err => {
      console.error('Error while verifying token', err);
      return res.status(403).json(err);
    })
  };

//Posting one single shout 
  
app.post('shout', FBAuth, (req, res) => {
    if (req.body.body.trim() === ''){
        return res.status(400).json({ body: 'Body must not be empty' });
    }

    const newShout = {
        body: req.body.body,
        userHandle: req.user.handle,
        createdAt: new Date().toISOString()
    };

    db
    .collection('shouts')
    .add(newShout)
    .then((doc) => {
    res.json({ message: `document ${doc.id} created successfully` });
    })
    .catch(err => {
    res.status(500).json({ error: 'something went wrong' });
    console.error(err);
    });
  });


// Fetch one Shout per post
app.get('/shout/:shoutId', (req, res) => {
    let shoutData = {};
    db.doc(`/shouts/${req.params.shoutId}`)
      .get()
      .then((doc) => {
        if (!doc.exists) {
          return res.status(404).json({ error: 'Shout not found' });
        }
        shoutData = doc.data();
        shoutData.shoutId = doc.id;
        return db
          .collection('comments')
          .orderBy('createdAt', 'desc')
          .where('shoutId', '==', req.params.shoutsId)
          .get();
      })
      .then((data) => {
        shoutsData.comments = [];
        data.forEach((doc) => {
          shoutsData.comments.push(doc.data());
        });
        return res.json(shoutData);
      })
      .catch((err) => {
        console.error(err);
        res.status(500).json({ error: err.code });
      });
  });


//Helper methods for email generation 

const isEmail = (email) => {
    const regEx= /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    if(email.match(regEx)) return true;
    else return false;
  }
  
  const isEmpty = (string) => {
    if (string.trim() === '') return true;
    else return false;
  }


//SignUp Route for users
app.post('/signup', (req,res) => {
    const newUser = {
      email: req.body.email,
      password: req.body.password,
      confirmPassword: req.body.confirmPassword,
      handle: req.body.handle
    };

    let errors = {};
    
    if(isEmpty(data.email)) {
      errors.email = 'Must not be empty'
    } else if (!isEmail(data.email)){
      errors.email = 'Must be a valid email address'
    }
  
    if(isEmpty(data.password)) errors.password= 'Must not be empty';
    if(data.password !== data.confirmPassword) errors.confirmPassword = 'Passwords must match';
    if(isEmpty(data.handle)) errors.handle = 'Must not be empty';

    if(Object.keys(errors).length > 0) return res.status(400).json(errors);
    
    
    //validate data
    let token, userId;
    db.doc(`/users/${newUser.handle}`).get()
      .then(doc => {
        if(doc.exists){
        return res.status(400).json({ handle: 'this handle is already taken'});
        } else {
        return firebase
        .auth()
        .createUserWithEmailAndPassword(newUser.email, newUser.password);
        }
      })
      .then(data => {
        userId = data.user.uid;
        return data.user.getIdToken();
      })
      .then((idToken) => {
        token = idToken;
        const userCredentials = {
          handle: newUser.handle,
          email: newUser.email,
          createdAt: new Date().toISOString(),
          userId
        };
        return db.doc(`/users/${newUser.handle}`).set(userCredentials);
      })
      .then((data) => {
        return res.status(201).json({ token });
      })
      .catch(err => {
        console.error(err);
        if(err.code === 'auth/email-already-in-use'){
          return res.status(400).json({ email: 'Email is already in use' });
        } else {
            return res.status(500).json({ error: err.code });
        }
      });
  })


//Login Route for users 
app.post('/login', (req,res) => {
  const user = {
    email: req.body.email,
    password: req.body.password
  };

  let errors= {};

  if (isEmpty(user.email)) errors.email = 'Must not be empty';
  if (isEmpty(user.password)) errors.password = 'Must not be empty';
  
  if(Object.keys(errors).length > 0) return res.status(400).json(errors);

  firebase
    .auth()
    .signInWithEmailAndPassword(user.email, user.password)
    .then(data => {
      return data.user.getIdToken();
    })
    .then (token => {
      return res.json({token});
    })
    .catch(err => {
      console.error(err);
      if(err.code === 'auth/wrong-password'){
        return res
        .status(403)
        .json({ general: 'Wrong credentials, please try again'});
      } else return res.status(500).json({ error: err.code });
    });
});


// Deleting a particular shout
app.delete('/shout/:shoutId', FBAuth, (req, res) => {
  const document = db.doc(`/shouts/${req.params.screamId}`);
  document
    .get()
    .then((doc) => {
      if (!doc.exists) {
        return res.status(404).json({ error: 'Shout not found' });
      }
      if (doc.data().userHandle !== req.user.handle) {
        return res.status(403).json({ error: 'Unauthorized' });
      } else {
        return document.delete();
      }
    })
    .then(() => {
      res.json({ message: 'Shout deleted successfully' });
    })
    .catch((err) => {
      console.error(err);
      return res.status(500).json({ error: err.code });
    });
  });


//user data
 exports.api = functions.https.onRequest(app);
