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

        let event = new Event({ createdBy: msg.author.id })

        //initialization of the event params
        event = await this.init(event, msg)
        if (!event) return msg.reply('opération annulée.') 
        
        //confirm creation
        const eventEmbed = event.getEmbed(msg)
        const eventResumeMsg = await msg.channel.send(eventEmbed)
        const m = await msg.channel.send(new MessageEmbed()
            .setTitle('Confirmes-tu la création de cet évènement ?')
            .setColor(color)
        )
        await m.react('✅') ; await m.react('❌')

        //wait for the user's reaction
        const filter = (reaction, user) => ["✅", "❌"].includes(reaction.emoji.name) && user.id === msg.author.id
        const reac = await m.awaitReactions(filter, { max: 1, time: 30000 })
        m.reactions.removeAll()
        if (!reac.first() || reac.first()?.emoji?.name === '❌') {
            await eventResumeMsg.edit(event.getEmbed(msg).setColor('ff0000'))
            await m.edit(new MessageEmbed().setTitle('Création de l\'évènement annulée...').setColor('ff0000'))
            return 
        }

        await eventResumeMsg.edit(event.getEmbed(msg).setColor('FFF100'))
        await m.edit(new MessageEmbed().setTitle('<a:loading:843899813871091742> Création en cours...').setColor('FFF100'))

        //create the event on discord
        await event.saveOnDiscord()

        //send role reaction
        const roleReactionMessage = await bot.channels.cache.get(config.channels.roleReaction).send(new MessageEmbed({ fields: [eventEmbed.fields[0] ] })
            .setTitle(event.getCategoryBaseName())
            .setColor(color)
            .setFooter('Clique sur la réaction ci-dessous pour rejoindre cet évènemet !')
        )
        event.setRoleReactionMessage(roleReactionMessage.id)
        await roleReactionMessage.react(config.emotes.participation)

        event.saveInDB()

        //confirmation message
        await eventResumeMsg.edit(event.getEmbed(msg).setColor('16C60C'))
        await m.edit(new MessageEmbed().setTitle('Évènement créé avec succès !').setColor('16C60C'))

    }



    async init (event, msg) {

        const setters = [
            'setTemplate',
            'setDate',
            'setTeams',
            'setExteriorMembers'
        ]

        for (const setter of setters) {
            event = await this[setter](event, msg)
            if (event === false) return false
        }

        return event
    }


    // ================== SETTERS ======================


    async setTemplate (event, msg) {

        const data = await this.askToUser(msg, `Entre le nom de la template voulue pour créer l'évènement.\nRappel des templates existantes :\n\`\`\`\n${db.templates.get('templates').map(e => e.name).value().join(' - ')}\n\`\`\``, db.templates.get('templates').map(e => e.name).value())
        if (data === -1) return false

        const template = db.templates.get('templates').find(e => e.name === data).value()

        event.setTemplate(template.name)
        event.setCategory()
        
        for (const channel of template.channels.concat(db.templates.get('default').value())) event.addChannel(channel)

        const roles = [
            {
                name: '▬▬▬▬▬',
                color: null,
                separatorRole: true
            },
            {
                name: `『${template.emote}』 ${template.fancyName}` ,
                color: null,
                defaultRole: true
            },
            {
                name: `🦺 ${template.fancyName} Orga` ,
                color: 'ff0000',
                orgaRole: true
            }
        ]

        for (const role of roles) event.addRole(role)

        return event
    }


    async setDate (event, msg) {

        const data = await this.askToUser(msg, `Entre la date de l'évènement dans le format \`dd/mm hh:mm\`.\nex : \`18/06 18h00\``)
        if (data === -1) return false

        const args = data.split(' ')

        if (args.length < 2) return false

        //check the validity of the date
        const day = args[0].split("/")[0],
              month = args[0].split("/")[1],
              hour = args[1].split("h")[0],
              minute = args[1].split("h")[1]

        if (
            (day < 1 || day > 31) ||
            (month < 1 || month > 12) ||
            (hour < 0 || hour > 24) ||
            (minute < 0 || minute > 60)
        ) {
            msg.reply("la date/heure renseignée n'est pas correcte.")
            return false
        }

        //set date
        event.setDate(new Date(2021, month - 1, day, hour, minute))
        
        return event
    }


    async setTeams (event, msg) {

        const data = await this.askToUser(msg, `Entre le nombre total d'équipes (\`0\` si pas d'équipes)`, [], 10)
        if (data === -1) return false

        //set the attributes
        const numberOfTeams = parseInt(data)

        for (let i = 0; i < numberOfTeams; i++) {
            event.addTeam()
        }

        return event
    }


    async setExteriorMembers (event, msg) {

        const data = await this.askToUser(msg, `Veux-tu que cet évènement soit accessible aux membres extérieurs à l'IUT ? (\`oui\` ou \`non\`)`, ['oui', 'non'])
        if (data === -1) return false

        event.setExteriorMembers(data === 'oui')

        return event
    }


    // =================== UTILS =======================


    async askToUser (msg, text, awaitedAnswers = [], interval = 0) {

        const m = await msg.channel.send(text)

        const rep = await msg.channel.awaitMessages(me => me.author.id === msg.author.id && (me.content.toLowerCase() === 'cancel' || (awaitedAnswers.length === 0 || awaitedAnswers.includes(me.content)) && (interval === 0 || (me.content >= 0 && me.content <= interval))), { max: 1, time: 120000 })
        if (!rep.first() || rep.first()?.content?.toLowerCase() === 'cancel') return -1

        await rep.first().delete()
        await m.delete()

        return rep.first().content
    }


}