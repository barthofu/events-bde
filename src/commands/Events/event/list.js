const commandParams = {
    
    name: "",
    aliases: [],
    args: [],
    desc: {
        en: "",
        fr: ""
    },
    enabled: true,
    dm: false,
    nsfw: false,
    memberPermission: [],
    botPermission: [],
    owner: false,
    cooldown: null

}

module.exports = class extends CommandPattern {

    constructor () {
        super(commandParams)
    }

    async run (msg, args, rawArgs, cmd) {

        const events = db.events.get('actives').value()

        let m = await msg.channel.send(new MessageEmbed()
            .setTitle('Liste des évènements')
            .setColor(color)
            .setAuthor(msg.author.username, msg.author.displayAvatarURL({dynamic: true}))
            .setDescription(db.events.get('actives').map(events.map((event, i) => `\`${i+1}.\` **${event.category.name}**`).join('\r\n')))
            .setFooter('Entre le numéro de l\'event désiré pour pouvoir le modifier ou le supprimer')
        )

        const rep = await msg.channel.awaitMessages(me => me.author.id === msg.author.id && me.content > 0 && me.content <= events.length, { max: 1, time: 120000 })
        if (!rep.first()) return
        await rep.first().delete()
        await m.delete()

        const selectedEvent = events[parseInt(rep.first().content) - 1]

        const event = new Event(selectedEvent)



    }


}