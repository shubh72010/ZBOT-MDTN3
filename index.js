const { Client, GatewayIntentBits, PermissionsBitField, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const http = require('http'); // Import the http module

const token = process.env.DISCORD_TOKEN;

let settings = {};
try {
    const settingsData = fs.readFileSync('./settings.json', 'utf8');
    settings = JSON.parse(settingsData);
} catch (error) {
    console.log('Could not find settings.json, creating a new settings object.');
}

const getGuildSettings = (guildId) => {
    if (!settings[guildId]) {
        settings[guildId] = {
            wordFilterEnabled: true,
            modLogChannelId: null
        };
        fs.writeFileSync('./settings.json', JSON.stringify(settings, null, 2));
    }
    return settings[guildId];
};

const spamMap = new Map();
const rateLimit = 5;
const timeFrame = 10000;

const scamKeywords = [
    'discord-nitro',
    'free-nitro',
    'gift',
    'giveaway',
    'steam-community',
    'discord-gift'
];

const badWords = ['badword1', 'badword2', 'anotherbadword'];

const minAccountAgeInDays = 7;

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);
    
    // Create the HTTP server to keep the bot alive on Render's free tier
    const server = http.createServer((req, res) => {
        // Only respond to root URL pings
        if (req.url === '/') {
            res.writeHead(200, { 'Content-Type': 'text/plain' });
            res.end('Bot is online!');
        } else {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('Not Found');
        }
    });

    const port = process.env.PORT || 3000;
    server.listen(port, () => {
        console.log(`Web server listening on port ${port} to prevent sleeping.`);
    });
});

client.on('guildMemberAdd', member => {
    const guildSettings = getGuildSettings(member.guild.id);
    const accountCreationDate = member.user.createdAt;
    const now = new Date();
    const accountAgeInMs = now.getTime() - accountCreationDate.getTime();
    const accountAgeInDays = Math.floor(accountAgeInMs / (1000 * 60 * 60 * 24));

    if (accountAgeInDays < minAccountAgeInDays) {
        const logEmbed = new EmbedBuilder()
            .setColor('#FF0000')
            .setTitle('Potential Alt Account Detected')
            .setDescription(`**${member.user.tag}** has been kicked for having a new account.`)
            .addFields(
                { name: 'User', value: `${member.user.tag} (${member.user.id})`, inline: true },
                { name: 'Account Age', value: `${accountAgeInDays} days`, inline: true }
            )
            .setTimestamp()
            .setFooter({ text: 'Automated Alt Account Detection' });

        const modLogChannel = member.guild.channels.cache.get(guildSettings.modLogChannelId);
        if (modLogChannel) {
            modLogChannel.send({ embeds: [logEmbed] });
        }

        member.kick(`Account age is less than ${minAccountAgeInDays} days.`).catch(console.error);
    }
});


client.on('messageCreate', async message => {
    if (message.author.bot) return;

    const guildSettings = getGuildSettings(message.guild.id);
    const messageContent = message.content.toLowerCase();

    if (guildSettings.wordFilterEnabled) {
        const containsBadWord = badWords.some(word => messageContent.includes(word));
        
        if (containsBadWord) {
            if (!message.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
                try {
                    await message.delete();
                    message.channel.send(`Hey, ${message.author}! Your message was deleted for containing a forbidden word. Please review the server rules.`);
                } catch (err) {
                    console.error('Failed to delete message with bad word:', err);
                }
                return;
            }
        }
    }

    const hasLink = messageContent.includes('http://') || messageContent.includes('https://');

    if (hasLink) {
        let isScam = false;
        for (const keyword of scamKeywords) {
            if (messageContent.includes(keyword)) {
                isScam = true;
                break;
            }
        }
        if (isScam) {
            if (!message.member.permissions.has(PermissionsBitField.Flags.KickMembers)) {
                try {
                    await message.delete();
                    message.channel.send(`Hey, ${message.author}! I've detected a potential scam link and deleted your message. Please be careful and do not click on suspicious links.`);
                } catch (err) {
                    console.error('Failed to delete scam message:', err);
                }
                return;
            }
        }
    }
    
    const user = message.author.id;
    if (!spamMap.has(user)) {
        spamMap.set(user, { count: 1, timer: setTimeout(() => {
            spamMap.delete(user);
        }, timeFrame) });
    } else {
        const userData = spamMap.get(user);
        userData.count++;
        if (userData.count > rateLimit) {
            const member = message.guild.members.cache.get(user);
            if (member && member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) {
                try {
                    await member.timeout(60000, 'Spamming');
                    message.channel.send(`${member.user.tag} has been timed out for spamming.`);
                    clearTimeout(userData.timer);
                    spamMap.delete(user);
                } catch (err) {
                    console.error('Failed to timeout member for spam:', err);
                }
            }
        }
    }
});


client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const { commandName } = interaction;
    const guildSettings = getGuildSettings(interaction.guild.id);

    if (commandName === 'ping') {
        await interaction.reply('Pong!');
    }

    if (commandName === 'kick') {
        if (!interaction.member.permissions.has(PermissionsBitField.Flags.KickMembers)) {
            return interaction.reply({ content: 'You do not have permission to use this command!', ephemeral: true });
        }
        const member = interaction.options.getMember('user');
        const reason = interaction.options.getString('reason') || 'No reason provided';
        
        if (!member) {
            return interaction.reply({ content: 'That user is not in the server.', ephemeral: true });
        }

        try {
            await member.kick(reason);
            await interaction.reply(`${member.user.tag} has been kicked for: ${reason}`);
        } catch (error) {
            console.error(error);
            await interaction.reply({ content: 'I was unable to kick the user.', ephemeral: true });
        }
    }

    if (commandName === 'ban') {
        if (!interaction.member.permissions.has(PermissionsBitField.Flags.BanMembers)) {
            return interaction.reply({ content: 'You do not have permission to use this command!', ephemeral: true });
        }
        const member = interaction.options.getMember('user');
        const reason = interaction.options.getString('reason') || 'No reason provided';
        
        if (!member) {
            return interaction.reply({ content: 'That user is not in the server.', ephemeral: true });
        }

        try {
            await member.ban({ reason });
            await interaction.reply(`${member.user.tag} has been banned for: ${reason}`);
        } catch (error) {
            console.error(error);
            await interaction.reply({ content: 'I was unable to ban the user.', ephemeral: true });
        }
    }

    if (commandName === 'timeout') {
        if (!interaction.member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) {
            return interaction.reply({ content: 'You do not have permission to use this command!', ephemeral: true });
        }

        const member = interaction.options.getMember('user');
        const duration = interaction.options.getInteger('duration');
        const reason = interaction.options.getString('reason') || 'No reason provided';
        
        if (!member) {
            return interaction.reply({ content: 'That user is not in the server.', ephemeral: true });
        }

        try {
            await member.timeout(duration * 60 * 1000, reason);
            await interaction.reply(`${member.user.tag} has been timed out for ${duration} minutes. Reason: ${reason}`);
        } catch (error) {
            console.error(error);
            await interaction.reply({ content: 'I was unable to timeout the user.', ephemeral: true });
        }
    }

    if (commandName === 'purge') {
        if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
            return interaction.reply({ content: 'You do not have permission to use this command!', ephemeral: true });
        }

        const amount = interaction.options.getInteger('amount');
        if (amount < 1 || amount > 100) {
            return interaction.reply({ content: 'You can only delete between 1 and 100 messages.', ephemeral: true });
        }

        try {
            await interaction.channel.bulkDelete(amount, true);
            await interaction.reply({ content: `Successfully deleted ${amount} messages.`, ephemeral: true });
        } catch (error) {
            console.error(error);
            await interaction.reply({ content: 'I was unable to purge messages.', ephemeral: true });
        }
    }

    if (commandName === 'toggle') {
        if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
            return interaction.reply({ content: 'You do not have permission to use this command!', ephemeral: true });
        }

        const feature = interaction.options.getString('feature');
        
        guildSettings[feature] = !guildSettings[feature];

        try {
            fs.writeFileSync('./settings.json', JSON.stringify(settings, null, 2));
            const status = guildSettings[feature] ? 'enabled' : 'disabled';
            await interaction.reply({ content: `The ${feature} feature has been **${status}**.` });
        } catch (error) {
            console.error('Failed to save settings.json:', error);
            await interaction.reply({ content: 'There was an error saving the setting.', ephemeral: true });
        }
    }

    if (commandName === 'setlogchannel') {
        if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
            return interaction.reply({ content: 'You do not have permission to use this command!', ephemeral: true });
        }

        const channel = interaction.options.getChannel('channel');
        guildSettings.modLogChannelId = channel.id;

        try {
            fs.writeFileSync('./settings.json', JSON.stringify(settings, null, 2));
            await interaction.reply(`Moderation log channel has been set to ${channel}.`);
        } catch (error) {
            console.error('Failed to save settings.json:', error);
            await interaction.reply({ content: 'There was an error saving the setting.', ephemeral: true });
        }
    }
});

client.login(token);
