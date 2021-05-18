module.exports = class {

    #id ; #createdBy ; #archived ; #template ; #date ; #teams ; #exteriorMembers ; #roleReactionMessage ; #participants ; #category ; #channels ; #roles

    constructor (args = {}) {

        this.#id = args.id || Date.now()
        this.#createdBy = args.createdBy || null
        this.#archived = false

        this.#template = args.template
        this.#date = args.date

        this.#teams = args.teams || 0
        this.#exteriorMembers = args.exteriorMembers || false

        this.#roleReactionMessage = args.roleReactionMessage
        this.#participants = args.participants || []

        this.#category = args.category || {}
        this.#channels = args.channels || []
        this.#roles = args.roles || []

    }


    // =============================================================================================================================================================
    // ============================================================ GETTERS ========================================================================================
    // =============================================================================================================================================================


    getEmbed (msg) {

        return new MessageEmbed()
            .setTitle(this.#category.name)
            .setColor(color)
            .setAuthor(msg.author.username, msg.author.displayAvatarURL({dynamic: true}))
            .addField('Informations', `
                Date : [${dateFormat(new Date(this.#date), 'dd/mm - HH:MM')}](https://google.com "lazare le plu bo de tous")
                Équipes : [${this.#teams}](https://google.com "Hammy > all")
                Ouvert aux membres extérieurs : [${this.#exteriorMembers ? 'Oui' : 'Non'}](https://google.com "Ckelpol?")
            `)
            .addField('Salons', '```\n' + this.#channels.map(channel => (channel.type === 'text' ? '# ' : '< ') + channel.name).join('\r\n') + '\n```', true)
            .addField('Rôles', '```\n' + this.#roles.map(role => role.name).join('\r\n') + '\n```', true)
    }


    getObject () { 

        return {
            id: this.#id,
            createdBy: this.#createdBy,
            archived: this.#archived,
            template: this.#template,
            date: this.#date,
            teams: this.#teams,
            exteriorMembers: this.#exteriorMembers,
            roleReactionMessage: this.#roleReactionMessage,
            participants: this.#participants,
            category: this.#category,
            channels: this.#channels,
            roles: this.#roles,
        }
    
    }


    getParticipants () {
        return this.#participants        
    }


    getCategoryBaseName () {

        const template = db.templates.get('templates').find(e => e.name === this.#template).value()
        return `『${template.emote}』 ${template.fancyName}`
    }


    getCategory () {
        return this.#category
    }


    getRoles () {
        return this.#roles
    }


    getId () {
        return this.#id
    }


    isArchived () {
        return this.#archived
    }


    getRoleReactionMessage () {
        return this.#roleReactionMessage
    }


    getExteriorMembers () {
        return this.#exteriorMembers
    }


    // =============================================================================================================================================================
    // ============================================================= SETTERS =======================================================================================
    // =============================================================================================================================================================


    setTemplate (templateName) {
        this.#template = templateName
    }


    setCategory () {

        this.#category.name = this.getCategoryBaseName()

        if (this.#date) this.setDate(this.#date)
    }


    addChannel (channelObj, pos = this.#channels.length) {
        this.#channels.splice(pos, 0, channelObj)
    }


    addRole (roleObj, pos = this.#roles.length) {
        this.#roles.splice(pos, 0, roleObj)
    }


    setDate (date) {

        this.#date = date

        const formatedDate = dateFormat(date, 'dd/mm')

        //change category name
        if (this.#category.name) this.#category.name = this.getCategoryBaseName(this.#template) + ' - ' + formatedDate
        //change roles name
        if (this.#roles.find(role => role.defaultRole)) this.#roles.find(role => role.defaultRole).name = this.#roles.find(role => role.defaultRole).name.split(' ').slice(0, 2).join(' ') + ' - ' + formatedDate
        if (this.#roles.find(role => role.orgaRole)) this.#roles.find(role => role.orgaRole).name = this.#roles.find(role => role.orgaRole).name.split(' ').slice(0, 3).join(' ') + ' - ' + formatedDate


    }


    setExteriorMembers (areExteriorMembersAllowed) {
        this.#exteriorMembers = areExteriorMembersAllowed
    }


    addParticipant (userId) {
        this.#participants.push(userId)
    }


    removeParticipant (userId) {
        this.#participants = this.#participants.filter(participant => participant !== userId)
    }


    setRoleReactionMessage (messageId) {
        this.#roleReactionMessage = messageId
    }


    addTeam () {

        const numberOfTeam = this.#roles.filter(e => e.teamRole).length + 1

        if (numberOfTeam === 1) {
            //create separator channel
            this.addChannel(
                {
                    name: "▬▬▬▬▬▬▬▬▬",
                    type: "text",
                    permissionsAuth: ["VIEW_CHANNEL"],
                    permissionsForbid: ["SEND_MESSAGES"],
                    defaultMessage: ""
                },
                this.#channels.findIndex(channel => channel.name === '⚙｜orga') - 1
            )
        }

        //add role
        this.addRole(
            {
                name: `『${config.teamsConfig[numberOfTeam - 1].emote}』 Équipe ${numberOfTeam}` ,
                color: config.teamsConfig[numberOfTeam - 1].color,
                teamRole: numberOfTeam
            }
        )

        //add text channel
        this.addChannel(
            {
                name: `${config.teamsConfig[numberOfTeam - 1].emote}｜équipe-${numberOfTeam}`,
                teamChannel: numberOfTeam,
                type: "text",
                permissionsAuth: [],
                permissionsForbid: [],
                defaultMessage: `Bienvenue dans le salon privé de l'équipe ${numberOfTeam} !`
            },
            this.#channels.findIndex(channel => channel.name === '⚙｜orga') - 1
        )

        //add voice channel
        this.addChannel({
            name: `${config.teamsConfig[numberOfTeam - 1].emote} ➤ Équipe ${numberOfTeam}`,
            teamChannel: numberOfTeam,
            type: "voice",
            permissionsAuth: [],
            permissionsForbid: [],
            defaultMessage: ''
        })

        this.#teams++

    }


    // =============================================================================================================================================================
    // ============================================================= SAVERS ========================================================================================
    // =============================================================================================================================================================


    saveInDB () {

        const actives = db.events.get('actives'),
              index = actives.findIndex(event => event.id === this.#id).value()
            
        if (index < 0) actives.push(this.getObject()).write()
        else actives.set(`[${index}]`, this.getObject()).write()

    }  


    async saveOnDiscord () {

            //roles
        
        let counter = 0

        for (const roleConfig of this.#roles) {

            if (roleConfig.id) { //role already exists

                counter++

                //search for changes
                const role = bot.guilds.cache.get(config.guildId).roles.cache.get(roleConfig.id)
                if (role.name !== roleConfig.name) await role.setName(roleConfig.name)
                if (role.color !== roleConfig.color) await role.setColor(roleConfig.color)

            } else { //role doesn't exist

                //create the role on discord
                const role = await bot.guilds.cache.get(config.guildId).roles.create({
                    data: {
                        name: roleConfig.name,
                        color: roleConfig.color,
                        mentionable: true
                    }
                })

                //define the correct position in the role list if needed
                if (counter > 0) {
                    const position = bot.guilds.cache.get(config.guildId).roles.cache.get(this.#roles[0].id).position - counter + 1
                    await role.setPosition(position)
                    counter++
                }

                //save the newly created role's id in the object
                this.#roles[this.#roles.indexOf(roleConfig)].id = role.id
            }
        }


            //category

        if (this.#category.id) { //category already exists

            //search for changes
            const category = bot.channels.cache.get(this.#category.id)
            if (this.#category.name !== category.name) await category.setName(this.#category.name)

        } else { //category doesn't exist

            //create the category on discord
            const category = await bot.guilds.cache.get(config.guildId).channels.create(this.#category.name, {
                type: "category",
                permissionOverwrites: [
                    { id: bot.guilds.cache.get(config.guildId).id, deny: ["VIEW_CHANNEL"] },
                    { id: this.#roles.find(role => role.defaultRole).id, allow: ["VIEW_CHANNEL"] },
                    { id: this.#roles.find(role => role.orgaRole).id, allow: ["VIEW_CHANNEL"] }
                ]
            })

            //change its position to the desired one
            await category.setPosition(bot.channels.cache.get(config.channels.archiveCategory).position)

            //save the newly created category's id in the object
            this.#category.id = category.id
        }


            //channels

        counter = 0

        for (const channelConfig of this.#channels) {

            if (channelConfig.id) { //channel already exists

                counter++

                //search for changes
                const channel = bot.channels.cache.get(channelConfig.id)
                if (channel.name !== channelConfig.name) await channel.setName(channelConfig.name)

            } else { //channel doesn't exist

                //define basic permissions
                const permissionOverwrites = [
                    { id: bot.guilds.cache.get(config.guildId).id, deny: ["VIEW_CHANNEL"] },
                    { id: this.#roles.find(role => role.defaultRole).id, allow: channelConfig.permissionsAuth, deny: channelConfig.permissionsForbid },
                    { id: this.#roles.find(role => role.orgaRole).id, allow: ["VIEW_CHANNEL", "SEND_MESSAGES"] }
                ]

                //define team permissions
                if (channelConfig.teamChannel) permissionOverwrites.push({ id: this.#roles.find(role => role.teamRole === channelConfig.teamChannel).id, allow: ["VIEW_CHANNEL"] })

                //create the channel
                const channel = await bot.guilds.cache.get(config.guildId).channels.create(channelConfig.name, {
                    parent: bot.channels.cache.get(this.#category.id),
                    type: channelConfig.type,
                    permissionOverwrites: permissionOverwrites
                })

                //define the correct position in the channel list if needed
                if (counter > 0) {
                    const position = bot.channels.cache.get(this.#channels[0].id).position + counter - 1
                    await channel.setPosition(position)
                    counter++
                }
    
                //send the default message in the channel if needed
                if (channelConfig.defaultMessage.length > 0) await channel.send(channelConfig.defaultMessage)
    
                //save the newly created channel's id in the object
                this.#channels[this.#channels.indexOf(channelConfig)].id = channel.id

            }

        }

    }

}