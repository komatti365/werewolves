/* werewolves bot */

const config = require('./config');
const token = require('./token').token;

const discord = require('discord.js');
const client = new discord.Client();

const msg_handler = require("./msg/msg_handler");
const failsafes = require("./failsafes");
failsafes(client) // actually run the darn thing

client.on('ready', () => {
  console.log("Logged in!")
});

client.on('message', msg => {
  msg_handler(msg, client);
});

require("./user/user").init()
client.login(token)
