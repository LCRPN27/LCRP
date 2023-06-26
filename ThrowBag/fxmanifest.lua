fx_version 'bodacious'
games { 'gta5' }

files {
	'contentunlocks.meta',
	'loadouts.meta',
	'pedpersonality.meta',
	'shop_weapon.meta',
	'weaponanimations.meta',
	'weaponarchetypes.meta',
	'weapons.meta'
}

client_scripts {
    'config_throwbag.lua',
    'cl_throwbag.lua',
}

server_scripts {
    'config_throwbag.lua',
    'sv_throwbag.lua',
}

data_file 'WEAPONINFO_FILE' 'weapons.meta'
data_file 'WEAPON_METADATA_FILE' 'weaponarchetypes.meta'
data_file 'WEAPON_SHOP_INFO' 'shop_weapon.meta'
data_file 'WEAPON_ANIMATIONS_FILE' 'weaponanimations.meta'
data_file 'CONTENT_UNLOCKING_META_FILE' 'contentunlocks.meta'
data_file 'LOADOUTS_FILE' 'loadouts.meta'
data_file 'PED_PERSONALITY_FILE' 'pedpersonality.meta'