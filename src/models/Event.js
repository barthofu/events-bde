const { MessageEmbed } = require("discord.js")

module.exports = class {

    constructor (msg, {
        id = null, createdBy = null, template = null, type = null, date = null, teams = null, exteriorMembers = null, category = null, channels = null, roles = null
    }) {

        this.id = id || Date.now()
        this.createdBy = createdBy || msg.author.id

        this.template = template
        this.type = type
        this.date = date

        this.teams = teams
        this.exteriorMembers = exteriorMembers || false

        this.category = category || {}
        this.channels = channels || []
        this.roles = roles || []

        this._msg = msg

    }


    async init () {

        const setters = [
            'setTemplate',
            'setDate',
            'setTeams',
            'setExteriorMembers'
        ]

        for (const setter of setters) {
            if (await this[setter]() === false) return false
        }

    }


    async create () {
        
        await this.createRoles()
        await this.createCategory()
        await this.createChannels()

        this.saveInDB()

    }


    saveInDB () {

        const actives = db.events.get('actives'),
              index = actives.findIndex(event => event.id === this.id).value()
        
        if (!index) actives.push(this.getObject()).write()
        else actives.set(`[${index}]`, this.getObject()).write()

    }  


    getEmbed () {

        return new MessageEmbed()
            .setTitle(this.category.name)
            .setColor(color)
            .setAuthor(this._msg.author.username, this._msg.author.displayAvatarURL({dynamic: true}))
            .addField('Informations', `
                Date : [${dateFormat(new Date(this.date), 'dd/mm - HH:MM')}](https://google.com "lazare il est bcp trop beau")
                Équipes : [${this.teams}](https://google.com "Hammy > all")
                Ouvert aux membres extérieurs : [${this.exteriorMembers ? 'Oui' : 'Non'}](https://google.com "Ckelpol?")
            `)
            .addField('Salons', '```\n' + this.channels.map(channel => (channel.type === 'text' ? '# ' : '< ') + channel.name).join('\r\n') + '\n```', true)
            .addField('Rôles', '```\n' + this.roles.map(role => role.name).join('\r\n') + '\n```', true)
    }


    getObject () { 
        
        const obj = this.pick('id', 'createdBy', 'template', 'type', 'date', 'teams', 'exteriorMembers', 'category', 'channels', 'roles')(this) 

        obj.category = { name: obj.category.name, id: obj.category.id }
        obj.channels = obj.channels.map(channel => ({
            name: channel.name,
            id: channel.id
        }))
        obj.roles = obj.roles.map(role => ({
            name: role.name,
            id: role.id
        }))

        return obj
    
    }


    // ================== SETTERS ======================

    async setTemplate () {

        const data = await this.askToUser(`template`, db.templates.get('templates').map(e => e.name).value())
        if (data === -1) return false

        const template = db.templates.get('templates').find(e => e.name === data).value()

        //set the attributes
        this.template = data
        this.category = {
            name: `『${template.emote}』 ${template.fancyName}`
        }
        this.type = template.type
        this.channels = template.channels.concat(db.templates.get('default').value())
        this.roles = [
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

        return true
    }


    async setDate () {

        const data = await this.askToUser(`date`)
        if (data === -1) return false

        const args = data.split(' ')

        if (args.length < 2) return false

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

        //set the attributes in the object
        this.date = new Date(2021, month - 1, day, hour, minute).getTime()
        this.category.name += ` - ${args[0]}`
        this.roles.find(role => role.defaultRole).name = this.roles.find(role => role.defaultRole).name.split(' ').slice(0, 2) + ' - ' + args[0]
        this.roles.find(role => role.orgaRole).name = this.roles.find(role => role.orgaRole).name.split(' ').slice(0, 3) + ' - ' + args[0]

        const defaultRole = this.roles.find(role => role.defaultRole),
              orgaRole = this.roles.find(role => role.orgaRole)

        //modify on discord
        if (this.category.id) bot.channels.cache.get(this.category.id).setName(this.category.name)
        if (defaultRole.id) this._msg.guild.roles.cache.get(defaultRole.id).setName(defaultRole.name)
        if (orgaRole.id) this._msg.guild.roles.cache.get(orgaRole.id).setName(orgaRole.name)

        return true
    }


    async setTeams () {

        const data = await this.askToUser(`teams`, [], 10)
        if (data === -1) return false

        //set the attributes
        this.teams = parseInt(data)

        const pos = this.channels.findIndex(channel => channel.name === '⚙｜orga') - 1
    
        for (let i = this.teams; i > 0; i--) {

            //add team channels
            this.channels.splice(pos, 0, {
                name: `${config.teamsConfig[i].emote}｜équipe-${i}`,
                teamChannel: i,
                type: "text",
                permissionsAuth: [],
                permissionsForbid: [],
                defaultMessage: `Bienvenue dans le salon privé de l'équipe ${i} !`
            })

            const iBis = this.teams - i + 1

            this.channels.push({
                name: `${config.teamsConfig[iBis].emote} ➤ Équipe ${iBis}`,
                teamChannel: iBis,
                type: "voice",
                permissionsAuth: [],
                permissionsForbid: [],
                defaultMessage: ''
            })

            //add roles
            this.roles.push({
                name: `『${config.teamsConfig[iBis].emote}』 Équipe ${iBis}` ,
                color: config.teamsConfig[iBis].color,
                teamRole: iBis
            })
        }

        //add separator channel
        this.channels.splice(pos, 0, {
            name: "▬▬▬▬▬▬▬▬▬",
            type: "text",
            permissionsAuth: ["VIEW_CHANNEL"],
            permissionsForbid: ["SEND_MESSAGES"],
            defaultMessage: ""
        })

        return true
    }


    async setExteriorMembers () {

        const data = await this.askToUser(`exterior members`, ['oui', 'non'])
        if (data === -1) return false

        this.exteriorMembers = data === 'oui' ? true : false

        return 1

    }


    // ================== CREATORS ======================


    async createRoles () {

        for (const i in this.roles) {

            const role = await this._msg.guild.roles.create({
                data: {
                  name: this.roles[i].name,
                  color: this.roles[i].color,
                  mentionable: true
                }
            })

            this.roles[i].id = role.id
        }

    }


    async createCategory () {

        const category = await this._msg.guild.channels.create(this.category.name, {
            type: "category",
            permissionOverwrites: [
                { id: this._msg.guild.id, deny: ["VIEW_CHANNEL"] },
                { id: this.roles.find(role => role.defaultRole).id, allow: ["VIEW_CHANNEL"] },
                { id: this.roles.find(role => role.orgaRole).id, allow: ["VIEW_CHANNEL"] }
            ]
        })
        await category.setPosition(bot.channels.cache.get(config.channels.archiveCategory).position)
        this.category.id = category.id

    }


    async createChannels () {

        const category = bot.channels.cache.get(this.category.id)

        for (const i in this.channels) {

            const channelConfig = this.channels[i]

            //define basic permissions
            const permissionsOverwrites = [
                { id: this._msg.guild.id, deny: ["VIEW_CHANNEL"] },
                { id: this.roles.find(role => role.defaultRole).id, allow: channelConfig.permissionsAuth, deny: channelConfig.permissionsForbid },
                { id: this.roles.find(role => role.orgaRole).id, allow: ["VIEW_CHANNEL", "SEND_MESSAGES"] }
            ]

            //define team permissions
            if (channelConfig.teamChannel) permissionsOverwrites.push({ id: this.roles.find(role => role.teamRole === channelConfig.teamChannel).id, allow: ["VIEW_CHANNEL"] })

            //create the channel
            const channel = await this._msg.guild.channels.create(channelConfig.name, {
                parent: category,
                type: channelConfig.type,
                permissionOverwrites: permissionsOverwrites
            })

            if (channelConfig.defaultMessage.length > 0) await channel.send(channelConfig.defaultMessage)

            //add the channel's id in the object
            this.channels[i].id = channel.id
        }

    }


    // =================== ADDERS =======================


    async addteam () {

        const numberOfTeams = this.roles.filter(e => e.teamRole).length,
              arrayPos = this.channels.findIndex(channel => channel.name === '⚙｜orga') - 1,
              channelPos = bot.channels.cache.get(this.channels[arrayPos].id).position





        //add role one discord
        //add channel on discord
        const channel = await this._msg.guild.channels.create(channelConfig.name, {
            parent: this.category.id,
            type: channelConfig.type,
            permissionOverwrites: permissionsOverwrites
        })

        //add channel to object
        this.channels.splice(arrayPos, 0, {

        })
        

    }





    // =================== UTILS =======================


    async askToUser (text, awaitedAnswers = [], interval = 0) {

        const m = this._msg.channel.send(text)

        const rep = await this._msg.channel.awaitMessages(me => me.author.id === this.createdBy && (me.content.toLowerCase() === 'cancel' || (awaitedAnswers.length === 0 || awaitedAnswers.includes(me.content)) && (interval === 0 || (me.content >= 0 && me.content <= interval))), { max: 1, time: 120000 })
        if (!rep.first() || rep.first()?.content?.toLowerCase() === 'cancel') return -1

        await m.delete()
        await rep.first().delete()

        return rep.first().content

    }


    pick = (...props) => o => props.reduce((a, e) => ({ ...a, [e]: o[e] }), {}) //pick only some properties from an object


}