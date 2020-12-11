// server.js
// where your node app starts

// we've started you off with Express (https://expressjs.com/)
// but feel free to use whatever libraries or frameworks you'd like through `package.json`.
const express = require("express");
const app = express();

const cors = require("cors");
app.use(cors());

//===================== from Glitch ==========================
// make all the files in 'public' available
// https://expressjs.com/en/starter/static-files.html
app.use(express.static("public"));
//===================== from Glitch ==========================

//===================== from Professor ==========================
app.get("/sourcecode", (req, res) => {
  res.send(
    require("fs")
      .readFileSync(__filename)
      .toString()
  );
});
//===================== from Professor ==========================

// The only libraries you are allowed to use are express, body-parser, cors and morgan.

let bodyParser = require("body-parser");
app.use(bodyParser.raw({ type: "*/*" }));
// app.use(bodyParser.json({ type: "*/*" }));

const userTokenMissing = "token field missing";
const userTokenInvalid = "Invalid token";

let passwords = new Map(); // key:username value:password
let sessions = new Map(); // key:userToken value:username
let items = new Map(); // key:itemToken value:{price,description,sellerUsername,buyerUsername,status,reviewed}
let sellers = new Map(); // key: sellerUsername value:[itemIds]
let carts = new Map(); // key:userToken value:[items]
let purchaseHistories = new Map(); // key:userToken value:[items]
let chats = new Map(); // key:userA|userB value:[{from,contents},{fron,contents},...]
let reviews = new Map(); // key:sellerUsername value:[[{"from":"sue","numStars":5,"contents":"great seller","itemid":"abcxyz"}]]

// ********************* FUNCTIONS ***********************************
// generates random tokens for sessions
let genToken = () => {
  let baseStr =
    "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let min = 0;
  let max = baseStr.length;
  let tokenLength = 64;

  let token = "";

  for (let i = 0; i < tokenLength; i++) {
    token += baseStr.charAt(Math.floor(Math.random() * (max - min + 1)) + min);
  }

  return token;
};

// return true if itemToken is found in itemsArr
let hasItem = (itemsArr, itemToken) => {
  for (let i = 0; i < itemsArr.length; i++) {
    if (itemsArr[i] === itemToken) {
      return true;
    }
  }

  return false;
};

// return array of cart items
let getItemsArray = itemTokens => {
  let itemsArray = [];

  for (let i = 0; i < itemTokens.length; i++) {
    let tmpObject = items.get(itemTokens[i]);
    itemsArray.push({
      price: tmpObject.price,
      description: tmpObject.description,
      itemId: itemTokens[i],
      sellerUsername: tmpObject.sellerUsername
    });
  
  }
  
  return itemsArray;
};

// return if item is available in listing (items map)
let isItemAvailable = cartItems => {
  for (let i = 0; i < cartItems.length; i++) {
    if (items.get(cartItems[i]).buyerUsername !== "") {
      return false;
    }
  }

  return true;
};


// mark items as sold to user at checkout
let markItemsAsSold = (itemList, buyerToken) => {
  for (let i = 0; i < itemList.length; i++) {
    items.get(itemList[i]).buyerUsername = sessions.get(buyerToken);
  }
};


// get the token from the username
let getTokeFromUsername = userName => {
  
  for (let [key, value] of sessions.entries()) {
      
    if (value === userName) {
      return key; // return the token of the user with userName
    }
  
  }
  
  return "";
  
};

// ******************************************************************************

app.post("/signup", (req, res) => {
  
  let parsed = undefined;
  let password = undefined;
  let username = undefined;
  
  if (req.body.length > 2) {
    parsed = JSON.parse(req.body);
    password = parsed.password;
    username = parsed.username;
  }
    
  if (password === undefined || password === "") {
    res.send(
      JSON.stringify({ success: false, reason: "password field missing" })
    );
    return;
  } else if (username === undefined || username === "") {
    res.send(
      JSON.stringify({ success: false, reason: "username field missing" })
    );
    return;
  } else if (passwords.has(username)) {
    res.send(JSON.stringify({ success: false, reason: "Username exists" }));
    return;
  }

  passwords.set(username, password);
  res.send(JSON.stringify({ success: true }));
  return;
});

app.post("/login", (req, res) => {
  
  let parsed = undefined;
  let password = undefined;
  let username = undefined;

  if (req.body.length > 2) {
    parsed = JSON.parse(req.body);
    password = parsed.password;
    username = parsed.username;
  }

  if (password === undefined) {
    res.send(
      JSON.stringify({ success: false, reason: "password field missing" })
    );
    return;
  } else if (username === undefined || username === "") {
    res.send(
      JSON.stringify({ success: false, reason: "username field missing" })
    );
    return;
  } else if (!passwords.has(username)) {
    res.send(JSON.stringify({ success: false, reason: "User does not exist" }));
    return;
  } else if (passwords.get(username) !== password) {
    res.send(JSON.stringify({ success: false, reason: "Invalid password" }));
    return;
  }

  let token = genToken();
  sessions.set(token, username);
  res.send(JSON.stringify({ success: true, token }));
  return;
});

app.post("/change-password", (req, res) => {
  let token = req.headers.token;
  
  let parsed = undefined;
  let oldPassword = undefined;
  let newPassword = undefined;

  if (req.body.length > 2) {
    parsed = JSON.parse(req.body);
    oldPassword = parsed.oldPassword;
    newPassword = parsed.newPassword;
  }
  
  if (token === undefined || token === "") {
    res.send(JSON.stringify({ success: false, reason: userTokenMissing }));
    return;
  } else if (!sessions.has(token)) {
    res.send(JSON.stringify({ success: false, reason: userTokenInvalid }));
    return;
  } else if (oldPassword !== passwords.get(sessions.get(token))) {
    res.send(
      JSON.stringify({ success: false, reason: "Unable to authenticate" })
    );
    return;
  }

  passwords.set(sessions.get(token), newPassword);
  res.send(JSON.stringify({ success: true }));
  return;
});

app.post("/create-listing", (req, res) => {
  let userToken = req.headers.token;
  
  let parsed = undefined;
  let price = undefined;
  let description = undefined;
  
  if (req.body.length > 2) {
    parsed = JSON.parse(req.body);
    price = parsed.price;
    description = parsed.description;
  }

  if (userToken === undefined || userToken === "") {
    res.send(JSON.stringify({ success: false, reason: userTokenMissing }));
    return;
  } else if (!sessions.has(userToken)) {
    res.send(JSON.stringify({ success: false, reason: userTokenInvalid }));
    return;
  } else if (price === undefined || price === "") {
    res.send(JSON.stringify({ success: false, reason: "price field missing" }));
    return;
  } else if (description === undefined || description === "") {
    res.send(
      JSON.stringify({ success: false, reason: "description field missing" })
    );
    return;
  }

  let itemToken = genToken();
  let newItem = { price, description, sellerUsername: sessions.get(userToken), buyerUsername:"", status:"", reviewed:false };
  items.set(itemToken, newItem);
  
  // updating sellers listing
  let sellerUsername = sessions.get(userToken);
  if (sellers.has(sellerUsername)) {
    sellers.get(sellerUsername).push(itemToken);
  } else {
    sellers.set(sellerUsername, [itemToken]);
  }
  
  res.send(JSON.stringify({ success: true, listingId: itemToken }));
  return;
});

app.get("/listing", (req, res) => {
  let itemToken = req.query.listingId;

  if (!items.has(itemToken)) {
    res.send(JSON.stringify({ success: false, reason: "Invalid listing id" }));
    return;
  }

  let tmpItem = items.get(itemToken);
  let listing = {
    price: tmpItem.price,
    description: tmpItem.description,
    itemId: itemToken,
    sellerUsername: tmpItem.sellerUsername
  };

  // {"success":true,"listing":{"price":15,"description":"a hat","itemId":"xyz123","sellerUsername":"bob"}}
  res.send(JSON.stringify({ success: true, listing }));
  return;
});

app.post("/modify-listing", (req, res) => {
  let userToken = req.headers.token;
  
  let parsed = undefined;
  let itemToken = undefined;
  let price = undefined;
  let description = undefined;

  if (req.body.length > 2) {
    parsed = JSON.parse(req.body);
    itemToken = parsed.itemid;
    price = parsed.price;
    description = parsed.description;
  }  
  
  if (userToken === undefined || userToken === "") {
    res.send(JSON.stringify({ success: false, reason: userTokenMissing }));
    return;
  } else if (!sessions.has(userToken)) {
    res.send(JSON.stringify({ success: false, reason: userTokenInvalid }));
    return;
  } else if (itemToken === undefined || itemToken === "") {
    res.send(
      JSON.stringify({ success: false, reason: "itemid field missing" })
    );
    return;
  }

  let modItem = items.get(itemToken); // passed by reference therefore no need to set it again in the Map
  if (price !== undefined && price !== "") {
    // modify only if price contains a value
    modItem.price = price;
  }

  if (description !== undefined && description !== "") {
    // modify only if description contains a value
    modItem.description = description;
  }

  res.send(JSON.stringify({ success: true }));
  return;
});

app.post("/add-to-cart", (req, res) => {
  let userToken = req.headers.token;
  
  let parsed = undefined;
  let itemToken = undefined;

  if (req.body.length > 2) {
    parsed = JSON.parse(req.body);
    itemToken = parsed.itemid;
  }  
  
  if (!sessions.has(userToken)) {
    res.send(JSON.stringify({ success: false, reason: userTokenInvalid }));
    return;
  } else if ((itemToken === undefined) || (itemToken === "")) {
    res.send(
      JSON.stringify({ success: false, reason: "itemid field missing" })
    );
    return;
  } else if (!items.has(itemToken)) {
    res.send(JSON.stringify({ success: false, reason: "Item not found" }));
    return;
  }

  let cartItems = carts.get(userToken);
  if (cartItems === undefined) {
    carts.set(userToken, [itemToken]);
  } else {
    if (!hasItem(cartItems, itemToken)) {
      cartItems.push(itemToken);
      carts.set(userToken, cartItems);
    }
  }

  res.send(JSON.stringify({ success: true }));
  return;
});

app.get("/cart", (req, res) => {
  let userToken = req.headers.token;

  if (!sessions.has(userToken)) {
    res.send(JSON.stringify({ success: false, reason: userTokenInvalid }));
    return;
  }
  
  let cart = [];
  if (carts.get(userToken) !== undefined) {
    cart = getItemsArray(carts.get(userToken));
  }

  res.send(JSON.stringify({ success: true, cart }));
  return;
});

app.post("/checkout", (req, res) => {
  let userToken = req.headers.token;

  if (!sessions.has(userToken)) {
    res.send(JSON.stringify({ success: false, reason: userTokenInvalid }));
    return;
  } else if (carts.get(userToken) === undefined) {
    res.send(JSON.stringify({ success: false, reason: "Empty cart" }));
    return;
  } else if (!isItemAvailable(carts.get(userToken))) {
    res.send(JSON.stringify({ success: false, reason: "Item in cart no longer available" }));
    return;
  }

  let purchasedItems = purchaseHistories.get(userToken);
  if (purchasedItems === undefined) {
    purchaseHistories.set(userToken, carts.get(userToken));
  } else {
    let tmpPurchase = purchaseHistories.get(userToken).concat(carts.get(userToken));
    purchaseHistories.set(userToken, tmpPurchase);
  }

  // mark all the cart items as sold in items array by including the buyer's username in the item properties
  markItemsAsSold(carts.get(userToken), userToken);

  // delete cart
  carts.delete(userToken);
  
  res.send(JSON.stringify({ success: true }));
  return;
});

app.get("/purchase-history", (req, res) => {
  let userToken = req.headers.token;

  if (userToken === undefined || userToken === "") {
    res.send(JSON.stringify({ success:false, reason: userTokenMissing }));
    return;
  } else if (!sessions.has(userToken)) {
    res.send(JSON.stringify({ success:false, reason: userTokenInvalid }));
    return;
  }

  res.send(JSON.stringify({ success:true, purchased: getItemsArray(purchaseHistories.get(userToken)) }));
  return;
});

app.post("/chat", (req, res) => {
  let userToken = req.headers.token;
  
  let parsed = undefined;
  let destination = undefined;
  let contents = undefined;
  
  if (req.body.length > 2) {
    parsed = JSON.parse(req.body);
    destination = parsed.destination;
    contents = parsed.contents;
  }
  
  let destinationToken = "";
  let sourceUsername = "";
  
  if ((userToken === undefined) || (userToken === "")) {
    res.send(JSON.stringify({ success:false, reason: userTokenMissing }));
    return;
  } else if (!sessions.has(userToken)) {
    res.send(JSON.stringify({ success:false, reason: userTokenInvalid }));
    return;
  } else if ((destination === undefined) || (destination === "")) {
    res.send(JSON.stringify({ success:false, reason: "destination field missing" }));
    return;
  } else if (contents === undefined) { // contents could be empty
    res.send(JSON.stringify({ success:false, reason: "contents field missing" }));
    return;
  }
  
  destinationToken = getTokeFromUsername(destination);
  sourceUsername = sessions.get(userToken);
  
  if (destinationToken === "") {
    res.send(JSON.stringify({ success:false, reason: "Destination user does not exist" }));
    return;
  }
  
  let chatKey = "";
  
  // to create key with usernames in alphabetical order
  if (sourceUsername < destination) {
    chatKey = sourceUsername + "|" + destination;
  } else {
    chatKey = destination + "|" + sourceUsername;
  }
  
  let messageArr = chats.get(chatKey);
  let message = {from:sourceUsername,contents};  
  
  if (messageArr === undefined) {
    chats.set(chatKey,[message]);
  } else {
    messageArr.push(message);
  }
  
  res.send(JSON.stringify({ success:true }))
  return;
  
});

app.post("/chat-messages", (req, res) => {
  let userToken = req.headers.token;
  let sourceUsername = "";
  
  let parsed = undefined;
  let destination = undefined;
  
  if (req.body.length > 2) {
    parsed = JSON.parse(req.body);
    destination = parsed.destination;
  }  
  
  if ((userToken === undefined) || (userToken === "")) {
    res.send(JSON.stringify({ success:false, reason: userTokenMissing }));
    return;
  } else if (!sessions.has(userToken)) {
    res.send(JSON.stringify({ success:false, reason: userTokenInvalid }));
    return;
  } else if ((destination === undefined) || (destination === "")) {
    res.send(JSON.stringify({ success:false, reason: "destination field missing" }));
    return;
  } else if (!passwords.has(destination)) {
    res.send(JSON.stringify({ success:false, reason: "Destination user not found" }));
    return;
  }
  
  sourceUsername = sessions.get(userToken);  
  let chatKey = "";
  
  // to create key with usernames in alphabetical order
  if (sourceUsername < destination) {
    chatKey = sourceUsername + "|" + destination;
  } else {
    chatKey = destination + "|" + sourceUsername;
  }
  
  res.send(JSON.stringify({ success:true, messages:chats.get(chatKey) }));
  
});

app.post("/ship", (req, res) => {
  let userToken = req.headers.token;
  
  let parsed = undefined;
  let itemToken = undefined;

  if (req.body.length > 2) {
    parsed = JSON.parse(req.body);
    itemToken = parsed.itemid;
  }  
  
  if ((userToken === undefined) || (userToken === "")) {
    res.send(JSON.stringify({ success: false, reason: userTokenMissing }));
    return;
  } else if (!sessions.has(userToken)) {
    res.send(JSON.stringify({ success: false, reason: userTokenInvalid }));
    return;
  } else if ((itemToken === undefined) || (itemToken === "")) {
    res.send(
      JSON.stringify({ success: false, reason: "itemid field missing" })
    );
    return;
  } else if (!items.has(itemToken)) {
    res.send(JSON.stringify({ success: false, reason: "Item not found" }));
    return;
  }
  
  let tmpItem = items.get(itemToken);
  
  if (tmpItem.buyerUsername === "") {
    res.send(JSON.stringify({ success: false, reason: "Item was not sold" }));
    return;
  } else if (tmpItem.status !== "") {
    res.send(JSON.stringify({ success: false, reason: "Item has already shipped" }));
    return;
  } else if (tmpItem.sellerUsername !== sessions.get(userToken)) {
    res.send(JSON.stringify({ success: false, reason: "User is not selling that item" }));
    return;
  }
  
  tmpItem.status = "shipped";
  res.send(JSON.stringify({ success: true }))
  return;
  
});

app.get("/status", (req, res) => {
  let itemToken = req.query.itemid;
  
  if ((itemToken === undefined) || (itemToken === "")) {
    res.send(JSON.stringify({ success: false, reason: "itemid field missing"}));
    return;
  } else if (!items.has(itemToken)) {
    res.send(JSON.stringify({ success: false, reason: "Item not found" }));
    return;
  } else if (items.get(itemToken).buyerUsername === "") {
    res.send(JSON.stringify({ success: false, reason: "Item not sold" }));
    return;
  } else if (items.get(itemToken).status !== "shipped") {
    res.send(JSON.stringify({ success: true, status: "not-shipped"  }));
    return;
  }
  
  res.send(JSON.stringify({ success: true, status: items.get(itemToken).status }));
  return;
  
});

app.post("/review-seller", (req, res) => {
  let userToken = req.headers.token;
  
  let parsed = undefined;
  let numStars = undefined;
  let contents = undefined;
  let itemToken = undefined;

  if (req.body.length > 2) {
    parsed = JSON.parse(req.body);
    numStars = parsed.numStars;
    contents = parsed.contents;
    itemToken = parsed.itemid;
  }  
  
  if ((userToken === undefined) || (userToken === "")) {
    res.send(JSON.stringify({ success: false, reason: userTokenMissing }));
    return;
  } else if (!sessions.has(userToken)) {
    res.send(JSON.stringify({ success: false, reason: userTokenInvalid }));
    return;
  } else if ((itemToken === undefined) || (itemToken === "")) {
    res.send(JSON.stringify({ success: false, reason: "itemid field missing"}));
    return;
  } else if (!items.has(itemToken)) {
    res.send(JSON.stringify({ success: false, reason: "Item not found" }));
    return;
  } else if (!hasItem(purchaseHistories.get(userToken), itemToken)) {
    res.send(JSON.stringify({ success:false, reason:"User has not purchased this item" }));
    return;
  } else if (items.get(itemToken).reviewed) {
    res.send(JSON.stringify({ success:false, reason:"This transaction was already reviewed" }));
    return;
  }
  
  // key:sellerUsername value:[[{"from":"sue","numStars":5,"contents":"great seller","itemid":"abcxyz"}]]
  let reviewerUsername = sessions.get(userToken);
  let sellerUsername = items.get(itemToken).sellerUsername;
  let reviewsArr = reviews.get(sellerUsername);
  let review = { from: reviewerUsername, numStars, contents, itemid: itemToken }
  
  if (reviewsArr === undefined) {
    reviews.set(sellerUsername,[review]);
  } else {
    reviewsArr.push(review);
  }
  
  items.get(itemToken).reviewed = true; // toggle reviewed flag to true
  
  res.send(JSON.stringify({ success:true }));
  return;
  
});

app.get("/reviews", (req, res) => {
  let sellerUsername = req.query.sellerUsername;
  
  let reviewsArr = reviews.get(sellerUsername);
  if (reviewsArr === undefined) {
    reviewsArr = [];
  }
  
  let reviewsArrString = JSON.stringify(reviewsArr, ['from','numStars','contents']); // to filter out the "itemId" from the result string
                                                                                      // took me a while to find how :)
  
  res.send(JSON.stringify({ success:true, reviews: JSON.parse(reviewsArrString) }));
  return;

});

app.get("/selling", (req, res) => {
  let sellerUsername = req.query.sellerUsername;
  
  if (sellerUsername === undefined || sellerUsername === "") {
    res.send(JSON.stringify({ success:false, reason: "sellerUsername field missing" }));
    return;
  }
  
  let sellerListing = [];
  let sellerListingItemIds = sellers.get(sellerUsername);
  
  if (sellerListingItemIds !== undefined) {
    sellerListing = getItemsArray(sellerListingItemIds);
  }
  
  res.send(JSON.stringify({ success:true, selling: sellerListing }));
  return;

});

// listen for requests :)
const listener = app.listen(process.env.PORT);
