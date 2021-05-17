const Event = require('../../../models/Event')

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
    memberPermission: ["ADMINISTRATOR"],
    botPermission: [],
    owner: false,
    cooldown: null

}

module.exports = class extends CommandPattern {

    constructor () {
        super(commandParams)
    }

    async run (msg, args, rawArgs, cmd) {

        const event = new Event(msg, {})

        //initialization of the event params
        if ( await event.init() === false) return msg.reply('opération annulée.') 
        
        //confirm creation
        await msg.channel.send(event.getEmbed())
        const m = await msg.channel.send(new MessageEmbed()
            .setTitle('Confirmes-tu la création de cet évènement ?')
            .setColor(color)
        )
        await m.react('✅') ; await m.react('❌')

        //wait for the user's reaction
        const filter = (reaction, user) => ["✅", "❌"].includes(reaction.emoji.name) && user.id === msg.author.id
        const reac = await m.awaitReactions(filter, { max: 1, time: 30000 })
        m.reactions.removeAll()
        if (!reac.first() || reac.first()?.emoji?.name === '❌') return m.edit(new MessageEmbed().setTitle('Création de l\'évènement annulée...').setColor('ff0000'))

        //create the event
        await event.create()

        //confirmation message
        await m.edit(new MessageEmbed().setTitle('Évènement créé avec succès !').setColor('16C60C'))

    }


}