const { REST, Routes } = require('discord.js');

// Get the token and client ID from environment variables
const token = process.env.DISCORD_TOKEN;
const clientId = process.env.DISCORD_CLIENT_ID;

const commands = [
    {
        name: 'ping',
        description: 'Replies with Pong!',
    },
    {
        name: 'kick',
        description: 'Kicks a user from the server.',
        options: [
            {
                name: 'user',
                description: 'The user to kick.',
                type: 6, // User type
                required: true,
            },
            {
                name: 'reason',
                description: 'The reason for kicking.',
                type: 3, // String type
                required: false,
            },
        ],
    },
    {
        name: 'ban',
        description: 'Bans a user from the server.',
        options: [
            {
                name: 'user',
                description: 'The user to ban.',
                type: 6, // User type
                required: true,
            },
            {
                name: 'reason',
                description: 'The reason for banning.',
                type: 3, // String type
                required: false,
            },
        ],
    },
    {
        name: 'timeout',
        description: 'Times out a user for a specified duration.',
        options: [
            {
                name: 'user',
                description: 'The user to timeout.',
                type: 6, // User type
                required: true,
            },
            {
                name: 'duration',
                description: 'The duration of the timeout in minutes.',
                type: 4, // Integer type
                required: true,
            },
            {
                name: 'reason',
                description: 'The reason for the timeout.',
                type: 3, // String type
                required: false,
            },
        ],
    },
    {
        name: 'purge',
        description: 'Deletes a specified number of messages from the channel.',
        options: [
            {
                name: 'amount',
                description: 'The number of messages to delete (1-100).',
                type: 4, // Integer type
                required: true,
            },
        ],
    },
    {
        name: 'toggle',
        description: 'Toggles a bot feature on or off.',
        options: [
            {
                name: 'feature',
                description: 'The feature to toggle.',
                type: 3, // String type
                required: true,
                choices: [
                    { name: 'wordfilter', value: 'wordFilterEnabled' }
                ]
            }
        ]
    },
    {
        name: 'setlogchannel',
        description: 'Sets the channel for moderation logs.',
        options: [
            {
                name: 'channel',
                description: 'The channel to set as the moderation log channel.',
                type: 7, // Channel type
                required: true,
            }
        ]
    }
];

const rest = new REST({ version: '10' }).setToken(token);

(async () => {
    try {
        if (!token || !clientId) {
            console.error('ERROR: Token or Client ID environment variables are not set. Cannot deploy commands.');
            return;
        }
        
        console.log(`Started refreshing ${commands.length} application (/) commands.`);

        const data = await rest.put(
            Routes.applicationCommands(clientId),
            { body: commands },
        );

        console.log(`Successfully reloaded ${data.length} application (/) commands.`);
    } catch (error) {
        console.error(error);
    }
})();
