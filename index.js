console.log("loading...");
(async()=>{
process.chdir(__dirname);
const Jimp = require("jimp");
const axios = require("axios");
const fs_ = require("fs");
const path = require("path");
if (process.env.PORT) {
	(new require("http").Server((req, res) => { res.writeHead(503); res.end(); })).listen(process.env.PORT);
	console.log("listening on", process.env.PORT);
}
const fs = fs_.promises;
const { Client, MessageAttachment, GatewayIntentBits } = require("discord.js");
const { SlashCommandBuilder } = require('@discordjs/builders');
const client = new Client({ intents: [
		GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildMessages,
		GatewayIntentBits.GuildMessageReactions,
//		GatewayIntentBits.MessageContent
], allowedMentions: { repliedUser: false, roles: [], users: [], parse: [] }});
var cache = {};
try {
	cache = JSON.parse(await fs.readFile("./cache.json"));
} catch (err) {
	console.error(err);
}
require("dotenv").config();
var images = {};
const imageList = [
	'blank.png', 'hotbar.png', 'inventory.png', 'items', 'shop.png', 'text_hotbar.png', 'text_shop.png', 'items/arrow_6.png', 'items/bow.png', 'items/brewing_stand.png', 'items/chainmail_boots.png', 'items/chest.png', 'items/clay.png', 'items/clay_16.png', 'items/compass.png', 'items/diamond_boots.png', 'items/diamond_sword.png', 'items/egg.png', 'items/enchanted_bow.png', 'items/enchanted_stick.png', 'items/end_stone_12.png', 'items/ender_pearl.png', 'items/fire_charge.png', 'items/glass_4.png', 'items/golden_apple.png', 'items/golden_sword.png', 'items/invisibility_potion.png', 'items/iron_boots.png', 'items/iron_pickaxe.png', 'items/iron_sword.png', 'items/jump_boost_potion.png', 'items/ladder_8.png', 'items/milk_bucket.png', 'items/obsidian_4.png', 'items/planks_16.png', 'items/shears.png', 'items/snowball.png', 'items/spawn.png', 'items/speed_potion.png', 'items/sponge_4.png', 'items/stone_sword.png', 'items/tnt.png', 'items/water_bucket.png', 'items/wooden_axe.png', 'items/wooden_pickaxe.png', 'items/wool_16.png'
].flatMap(i => [ `vanilla/${i}`, `pack/${i}` ]);
const promises = imageList.map(fileRelName => (async () => {
	let fileName = path.resolve("./images", fileRelName);
	if (!fileName.endsWith(".png")) return;
	let stat = await fs.lstat(fileName);
	if (!stat.isFile()) throw fileName + "isn't a file";
	await fs.access(fileName, fs_.constants.R_OK);
	let itemName = fileRelName.endsWith(".png") ? fileRelName.substring(0, fileRelName.length - 4) : fileRelName;
	let imageData = await fs.readFile(fileName);
	let image = await Jimp.read(imageData);
	images[itemName] = image;
})());
await Promise.all(promises);
const hypixelGet = axios.create({
	baseURL: "https://api.hypixel.net/",
	timeout: 10000,
	headers: { "API-Key": process.env.HYPIXEL_TOKEN },
});
setInterval(async () => {
	var exists = false;
	try {
		if (await fs.stat("./cache.json")) exists = true;
	} catch (err) {}
	if (exists) await fs.copyFile("./cache.json", "./cache.json.bak");
	await fs.writeFile("./cache.json", Buffer.from(JSON.stringify(cache, null, "\t")));
}, 1000);
const getExpire = () => Date.now() + 3600e3;
const getPlayerData = async (player) => {
	if (!player) throw "please specify UUID or username";
	var isUsername = player.match(/^[0-9a-zA-Z_]{1,16}$/);
	var isUUID =
		player.match(/^[a-f0-9]{8}\-[a-f0-9]{4}\-[a-f0-9]{4}\-[a-f0-9]{4}\-[a-f0-9]{12}$/) ||
		player.match(/^[A-F0-9]{8}\-[A-F0-9]{4}\-[A-F0-9]{4}\-[A-F0-9]{4}\-[A-F0-9]{12}$/) ||
		player.match(/^[a-f0-9]{32}$/) || player.match(/^[A-F0-9]{32}$/);
	player = player.toLowerCase();
	if (isUUID) player = player.replace(/[^a-f0-9]/g,"");
	if (isUsername || isUUID) {
		if (cache[player]) {
			if (Date.now() < cache[player].expires) {
				if (cache[player].error) throw cache[player].error;
				return cache[player].data;
			}
		}
		cache[player] = null;
		var url = "player?" + (isUUID ? "uuid" : "name") + "=" + player;
		try {
			console.log("fetching hypixel", url);
			var res = await hypixelGet({
				method: "get",
				url,
			});
			if (!res?.data) throw res;
			cache[player] = { error: false, data: res.data, expires: getExpire() };
			if (cache[player].data.player) cache[res.data.player.displayname.toLowerCase()] = cache[res.data.player.uuid] = cache[player];
		} catch (err) {
			cache[player] = { error: JSON.parse(JSON.stringify(err)), expires: getExpire() };
			throw cache[player].error;
		}
		return cache[player].data;
	} else {
		throw "Not a valid username or UUID";
	}
}
const generateImage = async (pack, type, items) => {
	if (type != "shop" && type != "hotbar") throw "type must be either shop or hotbar";
	var id = "image" + pack + type + "_" + JSON.stringify(items);
	if (!cache[id]) {
		var image = await Jimp.create(images[`${pack}/inventory`].bitmap.width, images[`${pack}/inventory`].bitmap.height, 0);
		image.blit(images[`${pack}/inventory`], 0, 0);
		image.blit(images[`${pack}/${type}`], 0, 0);
		image.blit(images[`${pack}/text_${type}`], 0, 0);
		for (let i = 0; i < items.length; ++i) {
			if (items[i]) {
				let x;
				let y;
				if (type == "hotbar") {
					x = 16+(i*36);
					y = 180;
				} else {
					x = 52+(i%7*36);
					y = 108+Math.floor(i/7)*36;
				}
				image.blit(images[`${pack}/${items[i]}`], x, y);
			}
		}
		cache[id] = await image.getBufferAsync(Jimp.MIME_PNG);
	}
	var img = cache[id];
	if (!Buffer.isBuffer(img)) img = Buffer.from(img.data);
	if (!Buffer.isBuffer(img)) throw "image isn't a buffer";
	return img;
}
const noEmoji = "<:no:786493314672099369>";
client.once("ready", async () => {
	console.log("ready");
	var dataLayout = new SlashCommandBuilder()
		.setName("layout")
		.setDescription("Show a player's shop or hot-bar layout")
		.addStringOption(option => option
			.setName("player")
			.setDescription("The player's username or UUID")
			.setRequired(true))
		.addStringOption(option => option
			.setName("layout")
			.setDescription("Show shop or hot-bar layout")
			.addChoices(
				{ name: "Hot-bar", value: "Hot-bar layout" },
				{ name: "Shop", value: "Shop layout" })
			.setRequired(true))
		.addBooleanOption(option => option
			.setName("text")
			.setDescription("Whether to show the text along with the picture")
			.setRequired(false))
		.addBooleanOption(option => option
			.setName("pack")
			.setDescription("Whether to use a custom resource pack")
			.setRequired(false))
		.toJSON();
	var dataSource = new SlashCommandBuilder()
		.setName("source")
		.setDescription("Source code is available on GitHub")
		.toJSON();
	//client.api.applications(client.user.id).commands.post({ data: dataLayout });
	//client.api.applications(client.user.id).commands.post({ data: dataSource });
	client.on("interactionCreate", async (i) => {
		if (!i.isCommand()) return;
		var ephemeral = i.channelId != "950654607745486888";
		if (i.commandName == "source") {
			try {
				await i.reply({ ephemeral, content: "Source code is available on GitHub: https://github.com/mekb-turtle/bed-wars-shop-layout" });
			} catch (err) {
				console.error(err);
			}
		} else if (i.commandName == "layout") {
			var opt = i.options;
			var player = opt.getString("player");
			var layout = opt.getString("layout");
			var pack = !!opt.getBoolean("pack") ? "pack" : "vanilla";
			var isText = !!opt.getBoolean("text");
			if (player && layout == "Hot-bar layout" || layout == "Shop layout") {
				try {
					const reply = data => i.reply({ ephemeral, ...data });
					var data = await getPlayerData(player);
					if (data.player) {
						var bedwars = data.player.stats?.Bedwars;
						var shopLayout = bedwars?.favourites_2
						var hotbarLayout = bedwars?.favorite_slots;
						if (layout == "Hot-bar layout") {
							if (!hotbarLayout) {
								reply({
									content: `${noEmoji} ${bedwars ?
										`This user hasn't edited their hot-bar layout before` :
										`Bed Wars data not found`}`,
									ephemeral: true
								});
							} else {
								hotbarLayout = hotbarLayout.trim().split(",").map(e => e == "null" ? null : e)
								var hotbarLayoutIcon = hotbarLayout.map(e => ({
									"Blocks": "clay", "Melee": "golden_sword", "Tools": "iron_pickaxe", "Ranged": "bow",
									"Potions": "brewing_stand", "Utility": "tnt", "Compass": "compass"
								}[e] || e)).map(e => typeof e == "string" ? "items/" + e : e);
								var hotbarLayoutLabel = hotbarLayout.map(e => e == null ? "~~      ~~" : e);
								var text = `Layout of ${data.player.displayname}:\n${hotbarLayoutLabel.join(", ")}`;
								var imageResult = await generateImage(pack, "hotbar", hotbarLayoutIcon);
								reply({
									content: isText ? text : `Layout of ${data.player.displayname}:`,
									files: [{ attachment: imageResult, description: isText ? undefined : text.replace(/\~\~      \~\~/g, "—–") }]
								})
							}
						} else if (layout == "Shop layout") {
							if (!shopLayout) {
								reply({
									content: `${noEmoji} ${bedwars ?
										`This user hasn't edited their shop layout before` :
										`Bed Wars data not found`}`,
									ephemeral: true
								});
							} else {
								shopLayout = shopLayout.trim().split(",").map(e => e == "null" ? null : e);
								var shopLayoutIcon = shopLayout.map(e => e == null ? "blank" : ({
									"oak_wood_planks": "planks_16", "bridge_egg": "egg", "dream_defender": "spawn",
									"fireball": "fire_charge", "stick_(knockback_i)": "enchanted_stick",
									"speed_ii_potion_(45_seconds)": "speed_potion", "jump_v_potion_(45_seconds)": "jump_boost_potion",
									"invisibility_potion_(30_seconds)": "invisibility_potion",
									"blast-proof_glass": "glass_4", "bow_(power_i__punch_i)": "enchanted_bow",
									"bow_(power_i)": "enchanted_bow", "magic_milk": "milk_bucket", "compact_pop-up_tower": "chest",
									"hardened_clay": "clay_16", "bedbug": "snowball", "arrow": "arrow_6", "end_stone": "end_stone_12",
									"ladder": "ladder_8", "obsidian": "obsidian_4", "sponge": "sponge_4", "wool": "wool_16"
								}[e] || e)).map(e => typeof e == "string" && e != "blank" ? "items/" + e : e);
								var shopLayoutLabel = shopLayout.map(e => e == null ? "~~      ~~" : ({
									"oak_wood_planks": "Wooden Planks", "bridge_egg": "Bridge Egg", "dream_defender": "Dream Defender",
									"fireball": "Fireball", "stick_(knockback_i)": "Knockback Stick",
									"speed_ii_potion_(45_seconds)": "Potion of Swiftness", "jump_v_potion_(45_seconds)": "Potion of Jump Boost",
									"invisibility_potion_(30_seconds)": "Potion of Invisibility",
									"blast-proof_glass": "Blast-proof Glass", "bow_(power_i__punch_i)": "Bow (Power I, Punch I)",
									"bow_(power_i)": "Bow (Power I)", "magic_milk": "Magic Milk", "compact_pop-up_tower": "Compact Pop-Up Tower",
									"hardened_clay": "Hardened Clay", "bedbug": "Bed-bug", "stone_sword": "Stone Sword", "shears": "Shears",
									"ender_pearl": "Ender Pearl", "iron_sword": "Iron Sword", "iron_boots": "Iron Armor",
									"wooden_axe": "Wooden Axe", "wooden_pickaxe": "Wooden Pickaxe", "wool": "Wool", "ladder": "Ladder",
									"tnt": "TNT", "golden_apple": "Golden Apple", "diamond_sword": "Diamond Sword",
									"diamond_boots": "Diamond Armor", "obsidian": "Obsidian", "bow": "Bow", "water_bucket": "Water Bucket",
									"sponge": "Sponge", "chainmail_boots": "Chainmail Armor", "arrow": "Arrows", "end_stone": "End Stone"
								}[e] || e));
								var imageResult = await generateImage(pack, "shop", shopLayoutIcon);
								var shopLayoutLabelSplit = [];
								while (shopLayoutLabel.length) {
									shopLayoutLabelSplit.push(shopLayoutLabel.splice(0, 7));
								}
								var text = `Layout of ${data.player.displayname}:\n${shopLayoutLabelSplit
									.map((e, i) => `${i + 1}. ${e.join(", ")}`).join(",\n")}`;
								reply({
									content: isText ? text : `Layout of ${data.player.displayname}:`,
									files: [{ attachment: imageResult, description: isText ? undefined : text.replace(/\~\~      \~\~/g, "—–") }]
								})
							}
						}
					} else {
						reply({
							ephemeral: true,
							content: noEmoji + " Player not found"
						});
					}
				} catch (err) {
					console.error("Error", err);
					console.log(err.status);
					i.reply({
						ephemeral: true,
						content: noEmoji + " " + (typeof err == "string" ? "Error: " + err : (err.status == 429 ? "Error: Rate limited, please try again later or choose another player" : "Error"))
					});
				}
			}
		}
	});
});
client.login(process.env.DISCORD_TOKEN);
})();
