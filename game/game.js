const config = require("../config")
const fs = require("fs")
const channel = require("../channel/channel_handler")
const user = require("../user/user.js")
const discord = require("discord.js")
const admin = require("../admin/admin")
const utils = require("../utils")
const game_state = require("./game_state")
const role_manager = require("./role_manager")
const PlayerController = require("./player_controller").PlayerController
const db_fns = require("./db_fns")
exports.commands = {}

/*
 ██████  ██████  ███    ██ ████████ ██████   ██████  ██      ██      ███████ ██████
██      ██    ██ ████   ██    ██    ██   ██ ██    ██ ██      ██      ██      ██   ██
██      ██    ██ ██ ██  ██    ██    ██████  ██    ██ ██      ██      █████   ██████
██      ██    ██ ██  ██ ██    ██    ██   ██ ██    ██ ██      ██      ██      ██   ██
 ██████  ██████  ██   ████    ██    ██   ██  ██████  ███████ ███████ ███████ ██   ██
*/
class GameController {
  constructor(client) {
    this.masters = client.channels.get(config.channel_ids.gm_confirm)
    this.masters.tell = (from_id, msg, ...rest)=>{
      this.masters.send(`[ <@${from_id}> ]: ${msg}`, ...rest)
    }
    this.u = user
    this.tags = db_fns.tags
    this.rels = db_fns.relationships
    this._client = client
    this._gamedb = db_fns._db
    this._userdb = this.u._db
    this.kill_q = exports.kill_q
  }
  get data(){
    return game_state.data()
  }
  player(id) {
    return new PlayerController(id, this._client)
  }
  async all_with_tag(tag) {
    var l = await db_fns.tags.all_with_tag(tag)
    var r = l.map(i=>this.player(i))
    return r
  }
  win(id_list) {
    if (id_list.length > 0 ) {
      this.masters.send(`I believe some players have won @here! I think that
  - ${id_list.join("\n -")}
  have all won! I could be wrong though! So I purposefully haven't done anything.`)
    }
  }
  kill(id, reason) {
    add_to_kill_q(id, reason, this._client)
  }
}

const scripts = {
  every_day: require("./scripts/every_day"),
  every_night: require("./scripts/every_night"),
  start: require("./scripts/start")
}
/*
 ██████  ██████  ███████ ███    ██ ███████ ██  ██████  ███    ██ ██    ██ ██████
██    ██ ██   ██ ██      ████   ██ ██      ██ ██       ████   ██ ██    ██ ██   ██
██    ██ ██████  █████   ██ ██  ██ ███████ ██ ██   ███ ██ ██  ██ ██    ██ ██████
██    ██ ██      ██      ██  ██ ██      ██ ██ ██    ██ ██  ██ ██ ██    ██ ██
 ██████  ██      ███████ ██   ████ ███████ ██  ██████  ██   ████  ██████  ██
*/

exports.commands.opensignup = function(msg, client) {
  // game state 0->1
  if (game_state.data().state_num !== 0){
    msg.channel.send("This is the wrong game state, buddy!")
  } else {
    game_state.set_state_num(1)
    msg.reply("the sign-up has been opened! Yay!")
  }
}
/*
 ██████   █████  ███    ███ ███████ ██ ███    ██ ███████  ██████
██       ██   ██ ████  ████ ██      ██ ████   ██ ██      ██    ██
██   ███ ███████ ██ ████ ██ █████   ██ ██ ██  ██ █████   ██    ██
██    ██ ██   ██ ██  ██  ██ ██      ██ ██  ██ ██ ██      ██    ██
 ██████  ██   ██ ██      ██ ███████ ██ ██   ████ ██       ██████
*/

exports.commands.gameinfo = function(msg, client) {
    utils.debugMessage("Game info command called")
    var data = game_state.data()
    var emb = new discord.RichEmbed()
    emb.title = "Game info"
    emb
      .setColor(0x44009b)
      .addField("Season name", `${data.season_name} (\`${data.season_code}\`)`)
      .addField("Game phase", `${game_state.nice_names[data.state_num]} (#${data.state_num})`)
      .addField("Game time", game_state.nice_time(data.time))
    msg.channel.send(emb)
}
/*
███████ ███████ ████████ ███████ ███████  █████  ███████  ██████  ███    ██ ██ ███    ██ ███████  ██████
██      ██         ██    ██      ██      ██   ██ ██      ██    ██ ████   ██ ██ ████   ██ ██      ██    ██
███████ █████      ██    ███████ █████   ███████ ███████ ██    ██ ██ ██  ██ ██ ██ ██  ██ █████   ██    ██
     ██ ██         ██         ██ ██      ██   ██      ██ ██    ██ ██  ██ ██ ██ ██  ██ ██ ██      ██    ██
███████ ███████    ██    ███████ ███████ ██   ██ ███████  ██████  ██   ████ ██ ██   ████ ██       ██████
*/

exports.commands.setseasoninfo = function(msg, client, args) {
    utils.debugMessage("Set season info command called")
    game_state.set_season_code(args[0])
    game_state.set_season_name(args.slice(1).join(" "))
}

/*
████████  █████   ██████  ███████
   ██    ██   ██ ██       ██
   ██    ███████ ██   ███ ███████
   ██    ██   ██ ██    ██      ██
   ██    ██   ██  ██████  ███████
*/

exports.commands.tag = function(msg, client, args) {
  if (game_state.data().state_num !== 4){
    msg.reply("a game is not in progress")
  } else {
    utils.debugMessage(`tag command: ${msg.content}`)
    var subcommand = args[0]
    switch (subcommand) {
      case "add":
        if (args.length !== 3) {
          msg.reply("wrong syntax!")
          return
        }
        user.resolve_to_id(args[1]).then(id=>{
          db_fns.tags.add_tag(id, args[2])
        })
        break
      case "remove":
        if (args.length !== 3) {
          msg.reply("wrong syntax!")
          return
        }
        user.resolve_to_id(args[1]).then(id=>{
          db_fns.tags.remove_tag(id, args[2])
        })
        break
      case "allwith":
        if (args.length !== 2) {
          msg.reply("wrong syntax!")
          return
        }
        db_fns.tags.all_with_tag(args[1]).then(list=>{
          msg.channel.send(`All players with tag \`${args[1]}\`:
${list.map(id=>`- <@${id}>`).join("\n")}`)
        })
        break
      case "allof":
        if (args.length !== 2) {
          msg.reply("wrong syntax!")
          return
        }
        user.resolve_to_id(args[1]).then(id=>{
          db_fns.tags.all_tags_of(id).then(list=>{
            msg.channel.send(`All tags of player <@${id}>:
${list.map(tag=>`- \`${tag}\``).join("\n")}`)
          })
        })
        break
    }
  }
}
/*
███████ ████████  █████  ██████  ████████ ███████ ███████  █████  ███████  ██████  ███    ██
██         ██    ██   ██ ██   ██    ██    ██      ██      ██   ██ ██      ██    ██ ████   ██
███████    ██    ███████ ██████     ██    ███████ █████   ███████ ███████ ██    ██ ██ ██  ██
     ██    ██    ██   ██ ██   ██    ██         ██ ██      ██   ██      ██ ██    ██ ██  ██ ██
███████    ██    ██   ██ ██   ██    ██    ███████ ███████ ██   ██ ███████  ██████  ██   ████
*/

exports.commands.startseason = function (msg, client) {
  // game state 1 -> 2
  // start a new season
  if (game_state.data().state_num !== 1) {
    msg.reply("we are not in the right game state to do that")
  } else {
    user.all_signed_up().then(asu=>{
      if (asu.length == 0) { // 0 players isn't enough!
        msg.reply("there aren't enough players signed up to do that.")
      } else {
        msg.channel.send("Starting season! Please check <#" + config.channel_ids.gm_confirm + "> and enter players' roles.");
        startgame(client);
      }
    })
  }
};

function startgame(client) {
  game_state.set_state_num(2)
  user.all_signed_up().then(asu=>{
    role_manager.all_roles_list().then(VALID_ROLES=>{
      gm_confirm = client.channels.get(config.channel_ids.gm_confirm)
      gm_confirm.send(`Signed up users: ${asu.map(id=>`\n- <@${id.user_id}>`)}`)
      gm_confirm.send(`Valid roles: ${VALID_ROLES.map(n=>`\n- \`${n}\` (${role_manager.role(n).name})`)}`)
      gm_confirm.send("For every user, please say `!g set_role @mention ROLE`")
    })
  })
}
/*
███████ ███████ ████████ ██████   ██████  ██      ███████
██      ██         ██    ██   ██ ██    ██ ██      ██
███████ █████      ██    ██████  ██    ██ ██      █████
     ██ ██         ██    ██   ██ ██    ██ ██      ██
███████ ███████    ██    ██   ██  ██████  ███████ ███████
*/

exports.commands.setrole = async function (msg, client, args) {
  // game state 2 only
  if (args.length !== 2) {
    msg.reply("invalid syntax!")
    return
  }
  let VALID_ROLES = await role_manager.all_roles_list()
  let usr = args[0]
  let role = args[1]
  if (game_state.data().state_num !== 2) {
    msg.reply("the sign-up is currently open, or a game is not being set up.\nI'm sorry for the inconvenience!")
  } else {
    if (!VALID_ROLES.includes(role)) {
      msg.reply("invalid role: `"+role+"`!")
    } else {
      var id = await user.resolve_to_id(usr)
      // now we need to check that user actually signed up
      var all = await user.all_signed_up()
      ids = all.map(row=>row.user_id) // get array of all the user ids
      if (!ids.includes(id)) {
        // that user hasn't signed up!
        msg.reply(`user <@${id}> hasn't signed up! Don't to give them a role, silly. 😏`)
      } else {
        msg.reply(`giving <@${id}> role ${role}`)
        user.finalise_user(client, id, role)
      }
    }
    setTimeout(()=>{ //delay by 1 sec to allow the database to be updated. it's not perfect but it works
      user.any_left_unfinalised().then(any_left => {
        if (!any_left) {
          // all players have a role assigned
          msg.reply("all players now have a role assigned.\nTo send everyone their roles, please type `!g send_roles`.")
        } else {
          // still some left
          msg.reply("there are still user(s) without a role.")
        }
      })
    }, 1000)
  }
}
/*
███████ ███████ ███    ██ ██████  ██████   ██████  ██      ███████ ███████
██      ██      ████   ██ ██   ██ ██   ██ ██    ██ ██      ██      ██
███████ █████   ██ ██  ██ ██   ██ ██████  ██    ██ ██      █████   ███████
     ██ ██      ██  ██ ██ ██   ██ ██   ██ ██    ██ ██      ██           ██
███████ ███████ ██   ████ ██████  ██   ██  ██████  ███████ ███████ ███████
*/

exports.commands.sendroles = async function(msg, client) {
  // game state 2->3
  if (game_state.data().state_num !== 2){
    msg.reply("the sign-up is currently open, or a game is not being set up.\nI'm sorry for the inconvenience!")
  } else {
    var any_left = await user.any_left_unfinalised()
    if (any_left) {
      msg.reply("that's not gonna work, pal. How do you expect me to send everyone their roles when you haven't even given everyone a role yet? ಠ_ಠ")
    } else {
      game_state.set_state_num(3)
      utils.infoMessage("Sending roles to players...")
      msg.reply("sending roles to all players!")
      var all_users = await user.all_alive()
      var id_list = all_users.map(row=>row.id)
      id_list.forEach(async function(id) {
        var role = await user.get_role(id)
        var u = client.users.get(id)
        if (u === undefined) {
          utils.warningMessage("Couldn't send message to user with ID "+id+"!")
          msg.reply(`couldn't send message to user <@${id}> (ID \`id\`)!`)
        } else {
          utils.infoMessage(`sending role to ${u.username}`) // NOTE: The following message still needs the season number.
          //This next line is still a WIP
          var role_i = role_manager.role(role)
          var str =
`This message is giving you your werewolves role, for *"${game_state.data().season_name}"*.

**Your role is ${role_i.name} (\`${role}\`).**

Role information:
${role_i.documentation}

**You are not allowed to share a screenshot of this message!** You can claim whatever you want about your role, but you may under **NO** circumstances show this message in any way to any other participants.
We hope you are happy with the role you gained, and we hope you'll enjoy the game as much as we do.

Good luck... :full_moon:


Do you not understand your role? Don't worry! Use the command \`!r info ROLE\` for an explanation. *(For example: \`!r info inno/basic\`)*
You can use commands in this Direct Message.
If you need help, don't ask me - I'm just a dumb robot. Ping the Game Masters in the actual server - they'll be happy to help.`
          u.send(str).catch(e=>{
            if (e.message == 'Cannot send messages to this user') {
              msg.reply(`user <@${id}> has DMs disabled!`)
              utils.warningMessage(`User ${u.username} has DMs disabled!`)
            }
          })
        }
      })
      msg.channel.send("All DMs sent!")
    }
  }
}
/*
██████  ███████  ██████  ██ ███    ██
██   ██ ██      ██       ██ ████   ██
██████  █████   ██   ███ ██ ██ ██  ██
██   ██ ██      ██    ██ ██ ██  ██ ██
██████  ███████  ██████  ██ ██   ████
*/

exports.commands.begin = async function(msg, client) {
  // game state 3->4
  // TODO: scripts/start here too
  if (game_state.data().state_num !== 3 ){
    msg.reply("this is the wrong game state for that, buddy.")
  } else {
    scripts.start(new GameController(client), (await user.all_alive()).map(r=>r.id)).then(()=>{
      msg.reply("😁, the game actually started, yay!")
      game_state.set_state_num(4)
    })
  }
}
/*
██████   █████  ██    ██
██   ██ ██   ██  ██  ██
██   ██ ███████   ████
██   ██ ██   ██    ██
██████  ██   ██    ██
*/

exports.commands.day = async function(msg, client) {
  if (game_state.data().state_num !== 4) {
    msg.reply("nope nope nope, wrong game state, mate.")
    return
  }
  var d = game_state.data()
  if (game_state.is_day(d.time)) {
    msg.reply("it's already day time! In particular, it's currently "+game_state.nice_time(d.time)+".")
  } else {
    game_state.next_day_or_night()
    await scripts.every_day(new GameController(client), await (user.all_alive()))
    await execute_kill_q(msg, client)
    day_and_night(msg, client)
    stats = require("../analytics/analytics.js").get_stats()
    msg.reply(`**Today's Stats:**\n - ${stats.Messages} messages were sent!\n - The Game Masters were pinged ${stats.GMPings} times!\n - ${stats.CCCreations} Conspiracy Channels were created!`)
    require("../analytics/analytics.js").reset_data(true)
    msg.reply(`[👍] It is now ${game_state.nice_time(d.time)}!`)
  }
}
/*
███    ██ ██  ██████  ██   ██ ████████
████   ██ ██ ██       ██   ██    ██
██ ██  ██ ██ ██   ███ ███████    ██
██  ██ ██ ██ ██    ██ ██   ██    ██
██   ████ ██  ██████  ██   ██    ██
*/

exports.commands.night = async function(msg, client) {
  if (game_state.data().state_num !== 4) {
    msg.reply("nope nope nope, wrong game state, mate.")
    return
  }
  var d = game_state.data()
  if (!game_state.is_day(d.time)) {
    msg.reply("it's already night time! In particular, it's currently "+game_state.nice_time(d.time)+".")
  } else {
    game_state.next_day_or_night()
    await scripts.every_night(new GameController(client), await (user.all_alive()))
    await execute_kill_q(msg, client)
    day_and_night(msg, client)
    msg.reply(`[👍] It is now ${game_state.nice_time(d.time)}!`)
  }
}
/*
██████   █████  ██    ██      █████  ███    ██ ██████      ███    ██ ██  ██████  ██   ██ ████████
██   ██ ██   ██  ██  ██      ██   ██ ████   ██ ██   ██     ████   ██ ██ ██       ██   ██    ██
██   ██ ███████   ████       ███████ ██ ██  ██ ██   ██     ██ ██  ██ ██ ██   ███ ███████    ██
██   ██ ██   ██    ██        ██   ██ ██  ██ ██ ██   ██     ██  ██ ██ ██ ██    ██ ██   ██    ██
██████  ██   ██    ██        ██   ██ ██   ████ ██████      ██   ████ ██  ██████  ██   ██    ██
*/

async function day_and_night(msg, client) {
  // check wins:
  var all_rows = await user.all_alive()
  var all_player_ids = all_rows.map(row=>row.id)
  var number_left = all_rows.length
  utils.debugMessage(`day_and_night users ${all_player_ids} num ${number_left}`)
  setTimeout(function(){
    Promise.all(all_player_ids.map(async function(user) {
    var player = new PlayerController(user)
    var role = role_manager.role(await player.role)
    if (role.tags && role.tags.wins_with) {
      return ({id:user, won: await db_fns.tags.all_have_tag(number_left, role.tags.wins_with)})
    } else {
      var fb = role_manager.fallback(await player.role)
      if (fb.tags && fb.tags.wins_with) {
        return ({id:user, won: await db_fns.tags.all_have_tag(number_left, fb.tags.wins_with)})
      }
    }
  })).then(data=>{
    // we now have something like [ {id:id, won:won}, {id:id, won:won}, ... ]
    winners = data.filter(item=>item.won)
    if (winners !== []) {
      new GameController(client).win(winners)
    }
  })}, 2e3)
}
/*
██   ██ ██ ██      ██           ██████ ███    ███ ██████
██  ██  ██ ██      ██          ██      ████  ████ ██   ██
█████   ██ ██      ██          ██      ██ ████ ██ ██   ██
██  ██  ██ ██      ██          ██      ██  ██  ██ ██   ██
██   ██ ██ ███████ ███████      ██████ ██      ██ ██████
*/

exports.commands.kill = async function(msg, client, args) {
  // kills someone
  // args[0] should be who killed them (how they died). currently 'l' for lynch or 'w' for werewolves.
  // args[1] should be who to kill
  if (args.length !== 2) {
    msg.reply("wrong syntax!")
  } else {
    var stupid_hack = true
    /*
    Stupid hacks - BenTechy66 2018 - To be sung to the tune of 'stupid deaths' from 'Horrible Histories'

    Stupid hacks, stupid hacks
    they're shitty but they work (He Heeeee~)

    stupid hacks, stupid hacks
    these lines are wasting space (Hoo Hooooo~)
    */
    var dead_person_id = await user.resolve_to_id(args[1]).catch(function(error) {
      msg.reply("Incorrect syntax / person to be killed! Syntax is: `g kill <why> <@who>`. for example, `g kill w @BenTechy66#8809`")
      stupid_hack = false
    })
    if (stupid_hack) {
      add_to_kill_q(dead_person_id, args[0], client)
      msg.reply(`Added ${args[1]} to Kill Queue for the next cycle`)
    }
  }
}
/*
██   ██ ██ ██      ██           ██████
██  ██  ██ ██      ██          ██    ██
█████   ██ ██      ██          ██    ██
██  ██  ██ ██      ██          ██ ▄▄ ██
██   ██ ██ ███████ ███████      ██████
                                   ▀▀
*/
exports.kill_q = {}
// I'm not sure which of these will be needed outside so I'll export all of them

function get_kq() {
  return require("./kill_queue.json")
}
exports.kill_q.get = get_kq

function write_kq(toWrite) {
  fs.writeFileSync("./game/kill_queue.json", JSON.stringify(toWrite))
}
exports.kill_q.write = write_kq

async function add_to_kill_q(who, why, client) {
  var kill_q = get_kq()
  utils.debugMessage("Got QK as " + kill_q)
  if (typeof kill_q == 'undefined') {
    kill_q = []
  }
  kill_q.push({
    who: who,
    why: why
  })
  write_kq(kill_q)
  utils.debugMessage("First item in Kill Q is now:" + kill_q[0].who + ":" + kill_q[0].why)
}
exports.kill_q.add = add_to_kill_q

async function execute_kill_q(msg, client) {
  return new Promise(function(resolve, reject) {
    var kill_q = get_kq()
    if (typeof kill_q == 'undefined') {
      kill_q = []
    }
    if (kill_q == []) {
      msg.reply("Nobody was killed, the Queue was empty.")
      resolve()
      return //No need to bother executing anything
    }
    msg.reply("Starting kill queue...")
    kill_q.forEach(function(death) {
      msg.reply(`Running through kill sequence for <@${death.who}>`)
      kill(death.who, death.why, client)
    })
    kill_q = []
    write_kq(kill_q)
    msg.reply("Finished executing Kill Queue")
    resolve()
  })
}
exports.kill_q.execute = execute_kill_q

/*
██   ██ ██ ██      ██
██  ██  ██ ██      ██
█████   ██ ██      ██
██  ██  ██ ██      ██
██   ██ ██ ███████ ███████
*/

async function kill(who, why, client) {
  // who should be id of who to kill
  // why should be who killed them (how they died)
  var their_role = await user.get_role(who)
  var their_role_i = role_manager.role(their_role)

  // TODO: more info available to functions
  var kill_desc = { by: why }
  var game = new GameController(client)
  var me = new PlayerController(who, client)
  var did_they_die
  if (typeof their_role_i.on_death === "function") {
    // there is a custom death function
    did_they_die = their_role_i.on_death(kill_desc, game, me)
  } else {
    // no custom death function
    // so we should use the fallback
    did_they_die = role_manager.fallback(their_role).on_death(kill_desc, game, me)
  }
  if (did_they_die) {
    set_dead(who, client)
  }
}
/*
███████ ███████ ████████     ██████  ███████  █████  ██████
██      ██         ██        ██   ██ ██      ██   ██ ██   ██
███████ █████      ██        ██   ██ █████   ███████ ██   ██
     ██ ██         ██        ██   ██ ██      ██   ██ ██   ██
███████ ███████    ██        ██████  ███████ ██   ██ ██████
*/

function set_dead(id, client) {
  // gives them the dead role
  let ch = client.channels.get(config.channel_ids.gm_confirm)
  ch.send(`<@${id}> is dead!`)
  ch.guild.fetchMember(id).then(m=>{
    if (m) {
      m.removeRole(config.role_ids.participant).then(m=>
        m.addRole(config.role_ids.dead).then(m=>
          user.set_alive(id, false)
        )
      )
    }
  })
}

async function is_allowed_channel(...args) {
  return channel.checkChannel(...args)
}

/*
 █████  ██████  ██ ██      ██ ████████ ██ ███████ ███████
██   ██ ██   ██ ██ ██      ██    ██    ██ ██      ██
███████ ██████  ██ ██      ██    ██    ██ █████   ███████
██   ██ ██   ██ ██ ██      ██    ██    ██ ██           ██
██   ██ ██████  ██ ███████ ██    ██    ██ ███████ ███████
*/

exports.commands.ability = async function(msg, client, args) {
  // for now it just does this
  exports.use_ability(msg, client, args[0], args.slice(1))
}
exports.use_ability = async function(msg, client, abn, rest) {
  // not an actual command
  var u = msg.author.id
  var r = await user.get_role(u)
  if (r == undefined) {
    msg.channel.send(`Hmm. That's interesting. I don't seem to have any records for ${msg.author}. Most likely you are not signed up.`)
  } else {
    var ri = role_manager.role(r)
    if (!await(is_allowed_channel(msg.channel.id, r))){
      msg.reply("This channel does not support that ability!\n*I'm not saying that you are or aren't able to use that ability: only that **if** you can, you can't use it here*")
    } else if (!await db_fns.timings.can_use(u, abn, game_state.data().time)) {
      msg.reply("you currently can't use that ability: you'll have to wait till later.\n*If you want to undo an ability or you think there is an error, please ping a game master.*")
    } else {
      if (ri.abilities && ri.abilities[abn] && typeof ri.abilities[abn].run == "function") {
        var abl = ri.abilities[abn]
        if (abl.timings && abl.timings.allow_night === false && !game_state.is_day()){
          msg.reply("it is currently night time, and that ability is not usable at night.")
        } else if (abl.timings && abl.timings.allow_day === false && !game_state.is_day()) {
          msg.reply("it is currently day time, and that ability is not usable in the day.")
        } else {
          msg.channel.send("Running ability...")
          utils.debugMessage(`${u} is running ability ${abn}; args ${rest}`)
          abl.run(new GameController(client), new PlayerController(msg.author.id, client), rest, function(worked, message) {
            if (worked) {
              db_fns.timings.add_next_time(u, abn, game_state.data().time + abl.timings.periods)
              msg.channel.send(message?message:"Your ability was successful!")
            } else {
              msg.channel.send(message?message:"Your ability failed.")
            }
          })
        }
      } else {
        msg.reply("you don't have an abiltiy with that name!")
      }
    }
  }
}
