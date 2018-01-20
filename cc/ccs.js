const config = require('../config'); //include main config
var fs = require('fs')

var ccconf; //decalre cc conf var as global

exports.createCmd = function(msg, client, args) { //mgs = msg obdj, client = bot client obdj, args = array of arguments
  msg.delete(); // del msg
  makeChannel(msg, client, args[0], args.slice(1));
}

function makeChannel(msg, client, name, people) { //functiohn to create ('PEOPLE' NEEDS TO BE AN ARRAY OF MENTIONS (<@ID>)) NEEDS TO BE FIXED
  if (name == "" || name[0] == "<") { //test to see if there are no arguments or if name should be thingy
    msg.reply("Incorenct syntax; you must specify a name ***did you forget?***").then(message => //allerts user of correct syntax
      message.delete(config.messageTimeout)) //deletes bots own message after time out
  }else if (people.length == 0){
    msg.reply("did you forget to invite someone? ***Partys are better with freidns.***").then(message =>
    message.delete(config.messageTimeout))
  }else{
    msg.reply(typeof(people));
    fs.readFile('./cc/cc.json', {
      encoding: 'utf-8'
    }, function(err, data) { //read cc.json to ccconfig
      if (err) throw err; //throw error
      ccconf = JSON.parse(data); //turns string into JSON object

      name = "S" + config.season + "_CC_" + name; //phrase name of channel
      ccconf.CC_catagory_number = parseInt(ccconf.CC_catagory_number) + 1 //increment the number of catgories
      categoryName = "S" + config.season + "_CC_" + ccconf.CC_catagory_number; //phrase name of catgories

      if (ccconf.CC_curent_category_id == "") { //makes a category if none exist
        msg.guild.createChannel(categoryName, "category").then(function(channel) { //make a new category
          console.log("had to make a new CC category")
          ccconf.CC_curent_category_id = channel.id //update current category id
          writecc(); //write new channel id and number to cc.json
        })
      }

      function createChannel(name, ccconf, msg) { //function to make a channel in a category, and make new category if full
        msg.guild.createChannel(name, "text").then(channel => //make a category
          channel.setParent(msg.guild.channels.get(ccconf.CC_curent_category_id)).catch(function(error) { //try to move the channel into a category, catching the errors
            if (error == "DiscordAPIError: Invalid Form Body\nparent_id: Maximum number of channels in category reached (50)") { //check that the error actually is that the category is full
              channel.delete() //delete the category
              msg.guild.createChannel(categoryName, "category").then(function(channel) { //make a new category
                ccconf.CC_curent_category_id = channel.id //update current category id
                writecc(); //write new channel id and number to cc.json
                createChannel(name, ccconf, msg) //try to make the channel again
              })
            }
          })
        ).then(function(channel) {
          channel.send(config.defaultMessage) //send the default message to the channel
          channel.overwritePermissions(client.user.id, { //the bot can see it
            VIEW_CHANNEL: true
          })
          channel.overwritePermissions(msg.guild.roles.get(config.role_ids.gameMaster), { //gamemaster can see it
            VIEW_CHANNEL: true
          })
          channel.overwritePermissions(msg.guild.roles.get(config.role_ids.everyone), { //@everyone can't see it
            VIEW_CHANNEL: false
          })
          channel.overwritePermissions(msg.author, { //author can see it
            VIEW_CHANNEL: true
          })
          people.forEach(function(element) {
            channel.overwritePermissions(msg.guild.members.get(element.slice(-19, -1)), { //everyone specified can see it
              VIEW_CHANNEL: true
            })
          })
          channel.send("<@" + msg.author.id + "> brought you together: " + people.join(", ")) //say whos in the CC
        });
      }
      createChannel(name, ccconf, msg) //run the category creation function
    })
  }
}

function writecc() { //function writes ccconf (odbj) to cc.json
  fs.writeFile('./cc/cc.json', JSON.stringify(ccconf), {
    encoding: 'utf-8'
  }, function(err) {
    if (err) throw err //throw error
  })
}
