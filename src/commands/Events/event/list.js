const Event = require("../../../models/Event")

const commandParams = {
    
    name: "",
    aliases: [],
    args: [
        {
            name: "--archived",
            variableName: "archived",
            type: "string",
            params: {
                equalsTo: ["--archived"]
            },
            optional: true
        }
    ],
    desc: {
        en: "",
        fr: "Permet de gérer, supprimer et archiver des évènements en toute simplicité."
    },
    enabled: true,
    dm: false,
    nsfw: false,
    memberPermission: ["MANAGE_MESSAGES"],
    botPermission: [],
    owner: false,
    cooldown: null

}

module.exports = class extends CommandPattern {

    constructor () {
        super(commandParams)
    }

    async run (msg, args = {}, rawArgs = [], cmd = this.info.name) {

        const events = db.events.get(args.archived ? 'archived' : 'actives').value()

        let m = await msg.channel.send(new MessageEmbed()
            .setTitle('Liste des évènements')
            .setColor(color)
            .setAuthor(msg.author.username, msg.author.displayAvatarURL({dynamic: true}))
            .setDescription(events.length === 0 ? 'Aucun évènements à venir...' : events.map((event, i) => `\`${i+1}.\` **${event.category.name}**`).join('\r\n'))
            .setFooter('Entre le numéro de l\'event désiré pour pouvoir le modifier, l\'archiver ou le supprimer')
        )

        if (events.length === 0) return

        await m.react('❌')

        const [rawData] = await Promise.race([
            msg.channel.awaitMessages(me => me.author.id === msg.author.id && me.content > 0 && me.content <= events.length, { max: 1, time: 30000 }),
            m.awaitReactions((reaction, user) => reaction.emoji.name === '❌' && user.id === msg.author.id, {max: 1, time: 30000})
        ])
        
        if (!rawData) {
            await m.delete()
            await msg.react('❌')
        }
        await m.delete()
        const data = rawData[1] 

        if (data.count) { //reaction
            await msg.react('✅')
        }
        else { //message
            await data.delete()

            const event = new Event(events[parseInt(data.content) - 1])
            await this.eventChoices(msg, event)  
        }
        
    }



    async eventChoices (msg, event) {

        //choose action
        const embed = event.getEmbed(msg)
            .addField('Actions', !event.isArchived() ? `
                \`1.\` Modifier la date
                \`2.\` Ajouter des équipes
                \`3.\` Modifier l'accès aux membres extérieurs
                
                \\◀️   Retour
                \\🗑️   Supprimer
                \\📥   Archiver
                
            ` : `\\◀️   Retour\n\\🗑️   Supprimer`
            )
            .setFooter('Rentre dans le tchat le numéro ou clique sur la réaction de l\'action que tu souhaites effectuer')

        const m = await msg.channel.send(embed)
        await m.react('◀️') ; await m.react('🗑️') ; await m.react('📥')

        const [rawData] = await Promise.race([
            m.awaitReactions((reaction, user) => ['◀️', '📥', '🗑️'].includes(reaction.emoji.name) && user.id === msg.author.id, { max: 1, time: 30000 }),
            msg.channel.awaitMessages(me => me.author.id && me.content > 0 && me.content <= 3, { max: 1, time: 30000 })
        ])

        if (!rawData) return msg.reply('tu as mis trop longtemps à répondre...')
        await m.delete()

        const data = rawData[1] 
        if (data.count) { //reaction

            if (data.emoji.name === '◀️') {
                if (event.isArchived()) await this.run(msg, { archived: '--archived' })
                else await this.run(msg)
            }
            else if (data.emoji.name === '📥') await this.archive(msg, event)
            else await this.delete(msg, event)

        } else { //message

            data.delete()
            if (data.content === '1') await this.modifyDate(msg, event)
            else if (data.content === '2') await this.addTeams(msg, event)
            else await this.modifyExteriorMembers(msg, event)
        }

    }



    async archive (msg, event) { 

        if (!(await this.confirmationMessage(msg, 'archiver'))) return await this.eventChoices(msg, event)

        //archive the event...

            //...in the db
        const eventObj = event.getObject()
        obj.archived = true
        db.events.get('archived').push(eventObj).write()
        db.events.get('actives').remove({ id: event.getId() }).write()

            //...on discord

        const category = bot.channels.cache.get(event.getCategory().id)

        //delete participation message
        if (event.getRoleReactionMessage()) {
            const message = bot.channels.cache.get(config.channels.roleReaction).messages.fetch(event.getRoleReactionMessage())
            await message?.delete?.()
            event.setRoleReactionMessage(null) 
        }
        //change the position
        await category.edit({position: bot.channels.cache.get(config.channels.archiveCategory).position})
        //change the name
        await category.setName(category.name.split('』').slice(1).join(' '))
        //delete roles
        await this.deleteRoles(msg.guild, event)

        if (event.isArchived()) await this.run(msg, { archived: '--archived' })
        else await this.run(msg)
    }



    async delete (msg, event) {

        if (!(await this.confirmationMessage(msg, 'supprimer'))) return await this.eventChoices(msg, event)

        //delete the event...

            //...in the db
        db.events.get(event.isArchived() ? 'archived' : 'actives').remove({ id: event.getId() }).write()

            //...on discord

        const category = bot.channels.cache.get(event.getCategory().id)
                
        //delete participation message
        if (event.getRoleReactionMessage()) {
            const message = bot.channels.cache.get(config.channels.roleReaction).messages.fetch(event.getRoleReactionMessage())
            await message?.delete?.()
            event.setRoleReactionMessage(null) 
        }
        //channels
        for (const channel of category.children) await bot.channels.cache.get(channel[0]).delete()
        await category.delete()
        //roles
        await this.deleteRoles(msg.guild, event)

        if (event.isArchived()) await this.run(msg, { archived: '--archived' })
        else await this.run(msg)
                
    }



    // ================ Modifiers



    async modifyDate (msg, event) {

        event = await bot.commands.get('event/create').setDate(event, msg)

        await this.save(event)
        return await this.eventChoices(msg, event)
    }



    async addTeams (msg, event) {

        const data = await bot.commands.get('event/create').askToUser(msg, `Combien souhaites-tu rajouter d'équipes ? (\`0\` si pas d'équipe en plus)`, [], 10)
        if (data === -1) return false

        //set the attributes
        const numberOfTeams = parseInt(data)

        for (let i = 0; i < numberOfTeams; i++) {
            event.addTeam()
        }

        await this.save(event)
        return await this.eventChoices(msg, event)
    }


    
    async modifyExteriorMembers (msg, event) {

        event = await bot.commands.get('event/create').setExteriorMembers(event, msg)

        await this.save(event)
        return await this.eventChoices(msg, event)
    }



    // ============= Utils



    async confirmationMessage (msg, message) {

        const m = await msg.channel.send(`Es-tu sûr(e) de vouloir ${message} cet évènement ?`)
        await m.react('✅') ; await m.react('❌')

        const reac = await m.awaitReactions((reaction, user) => ['❌', '✅'].includes(reaction.emoji.name) && user.id === msg.author.id, {max: 1, time: 20000})
        if (!reac.first() || reac.first()?.emoji.name === '❌') return false
        await m.delete()

        return true
    }



    async deleteRoles (guild, event) {

        for (const role of event.getRoles()) {
            await guild.roles.cache.get(role.id)?.delete?.()
        }

    }



    async save (event) {

        await event.saveOnDiscord()
        event.saveInDB()
    }

}