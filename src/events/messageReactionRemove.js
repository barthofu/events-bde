const Event = require('../models/Event')

module.exports = class {

    async run (reaction, user) {

        if (reaction.partial) await reaction.fetch()

        if (reaction.message.channel.id === config.channels.roleReaction && reaction.emoji.name === config.emotes.participation && !user.bot) {

            //get the corresponding event
            const eventObj = db.events.get('actives').find(event => event.roleReactionMessage === reaction.message.id).value()
            if (!eventObj) return

            const event = new Event(eventObj),
                  member = bot.guilds.cache.get(config.guildId).members.cache.get(user.id)

            //remove role from user
            const roleId = event.getRoles().find(role => role.defaultRole).id
            member.roles.remove(roleId)

            //remove user from participant list
            event.removeParticipant(member.id)
        }

    }

}