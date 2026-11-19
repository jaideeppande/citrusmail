// The emoji the composer offers: a few hundred people actually use, each
// with the words it can be found by. Kept here as plain text rather than
// pulled from a package, so the picker costs a few kilobytes and no download.
// One per line: the emoji, its name (underscores for spaces), then keywords

export interface Emoji {
  emoji: string
  /** "thumbs up" */
  name: string
  /** What `:name` matches in the editor: "thumbs_up" */
  shortcodes: string[]
  /** Other words it is found by */
  tags: string[]
  category: string
}

export interface EmojiCategory {
  id: string
  label: string
  icon: string
  items: Emoji[]
}

const SMILEYS = `
😀 grinning smile happy
😃 smiley smile happy joy
😄 smile happy laugh
😁 grin beaming smile teeth
😆 laughing haha satisfied
😅 sweat_smile relief nervous phew
🤣 rofl rolling laughing lol
😂 joy tears laughing lol
🙂 slight_smile smile fine
🙃 upside_down silly sarcasm
😉 wink flirt
😊 blush smile happy pleased
😇 innocent angel halo
🥰 smiling_hearts love adore
😍 heart_eyes love crush
🤩 star_struck excited wow
😘 kiss blowing love
😗 kissing kiss
😋 yum tasty delicious
😛 tongue playful
😜 wink_tongue joke silly
🤪 zany crazy silly
😝 squint_tongue playful
🤑 money_mouth rich dollar
🤗 hug hugging thanks
🤭 hand_over_mouth oops giggle
🤫 shush quiet secret
🤔 thinking hmm consider
🤐 zipper_mouth secret quiet
🤨 raised_eyebrow sceptical doubt
😐 neutral meh blank
😑 expressionless blank
😶 no_mouth silent speechless
😏 smirk smug
😒 unamused annoyed meh
🙄 eye_roll annoyed whatever
😬 grimace awkward nervous
😌 relieved calm content
😔 pensive sad thoughtful
😪 sleepy tired
😴 sleeping zzz tired
😷 mask sick ill
🤒 thermometer sick fever ill
🤕 bandage hurt injured
🤢 nauseated sick gross
🤧 sneeze cold sick tissue
🥵 hot heat sweating
🥶 cold freezing
🥴 woozy dizzy tipsy
😵 dizzy overwhelmed
🤯 mind_blown exploding shocked
🤠 cowboy yeehaw
🥳 party celebrate birthday congratulations
😎 sunglasses cool
🤓 nerd geek glasses
🧐 monocle curious inspect
😕 confused unsure
😟 worried concerned
🙁 slight_frown sad
😮 open_mouth surprised wow
😯 hushed surprised
😲 astonished shocked wow
😳 flushed embarrassed shy
🥺 pleading puppy please
😦 frowning shocked
😧 anguished worried
😨 fearful scared afraid
😰 anxious nervous sweat
😥 sad_relieved disappointed phew
😢 cry sad tear
😭 sob crying bawling
😱 scream shocked horror
😖 confounded frustrated
😣 persevere struggling
😞 disappointed sad
😓 downcast sweat tired
😩 weary tired exhausted
😫 tired exhausted fed_up
🥱 yawn bored tired
😤 huff triumph annoyed
😡 rage angry mad
😠 angry mad
🤬 cursing swearing angry
😈 smiling_devil mischief
💀 skull dead
💩 poop poo
🤡 clown silly
👻 ghost boo halloween
👽 alien ufo
🤖 robot bot
😺 smiling_cat cat happy
🙈 see_no_evil monkey shy
🙉 hear_no_evil monkey
🙊 speak_no_evil monkey oops
`

const PEOPLE = `
👋 wave hello hi bye
🤚 raised_back_hand stop
✋ raised_hand stop high_five
🖖 vulcan spock
👌 ok_hand perfect okay
🤌 pinched_fingers italian
🤏 pinching small tiny
✌️ victory peace
🤞 crossed_fingers luck hope
🤟 love_you gesture
🤘 rock_on horns metal
🤙 call_me shaka hang_loose
👈 point_left
👉 point_right
👆 point_up
👇 point_down
☝️ index_up one wait
👍 thumbs_up yes approve like good plus_one
👎 thumbs_down no dislike bad
✊ raised_fist solidarity
👊 fist_bump punch
👏 clap applause bravo well_done
🙌 raised_hands hooray celebrate praise
👐 open_hands
🤲 palms_up
🤝 handshake deal agreement
🙏 pray thanks please grateful
✍️ writing sign
💪 muscle strong flex
🧠 brain smart idea
👀 eyes look see watching
👁️ eye see
👂 ear listen
👄 mouth lips
💋 kiss_mark lips
👶 baby child
🧒 child kid
👦 boy
👧 girl
🧑 person adult
👨 man
👩 woman
🧓 older_person elder
🙋 raising_hand question volunteer me
🤦 facepalm oh_no
🤷 shrug dunno whatever
🙅 no_good refuse
🙆 ok_person all_good
💁 tipping_hand info
🧑‍💻 technologist developer coder laptop
🧑‍🏫 teacher lecture
🧑‍🍳 cook chef
🧑‍🔧 mechanic fix
🧑‍⚕️ health_worker doctor nurse
👮 police officer
🕵️ detective investigate
👷 construction_worker builder
🤴 prince royal
👸 princess royal
🦸 superhero hero
🚶 walking walk
🏃 running run hurry
💃 dancer dance party
🕺 man_dancing dance party
👫 couple pair
👪 family
`

const NATURE = `
🐶 dog puppy pet
🐱 cat kitten pet
🐭 mouse
🐹 hamster
🐰 rabbit bunny
🦊 fox
🐻 bear
🐼 panda
🐨 koala
🐯 tiger
🦁 lion
🐮 cow
🐷 pig
🐸 frog
🐵 monkey
🐔 chicken
🐧 penguin
🐦 bird
🦆 duck
🦉 owl wise
🦄 unicorn magic
🐝 bee honey busy
🦋 butterfly
🐌 snail slow
🐞 ladybug bug
🐢 turtle slow
🐍 snake
🐙 octopus
🐠 fish
🐬 dolphin
🐳 whale
🦈 shark
🐘 elephant
🐴 horse
🐑 sheep
🐕 dog_walking
🐈 cat_walking
🌵 cactus
🎄 christmas_tree xmas
🌲 evergreen tree pine
🌳 tree
🌴 palm_tree beach holiday
🌱 seedling sprout grow
🌿 herb leaf
🍀 four_leaf_clover luck
🍁 maple_leaf autumn fall
🍂 fallen_leaf autumn
🌷 tulip flower spring
🌹 rose flower love
🌺 hibiscus flower
🌸 cherry_blossom flower spring
🌼 blossom flower
🌻 sunflower flower
💐 bouquet flowers
🌞 sun_face sunny
🌝 full_moon_face
🌙 crescent_moon night
⭐ star favourite
🌟 glowing_star shine
✨ sparkles shiny new magic
⚡ zap lightning fast
🔥 fire hot lit flame
💥 boom collision bang
🌈 rainbow
☀️ sunny sun weather
⛅ partly_cloudy weather
☁️ cloud weather
🌧️ rain weather
⛈️ storm thunder weather
❄️ snowflake cold winter
☃️ snowman winter
💧 droplet water
🌊 wave ocean sea
`

const FOOD = `
🍏 green_apple fruit
🍎 apple fruit
🍐 pear fruit
🍊 orange tangerine citrus fruit
🍋 lemon citrus fruit
🍌 banana fruit
🍉 watermelon fruit
🍇 grapes fruit
🍓 strawberry fruit
🍒 cherries fruit
🍑 peach fruit
🥭 mango fruit
🍍 pineapple fruit
🥥 coconut
🥝 kiwi fruit
🍅 tomato
🥑 avocado
🥦 broccoli vegetable
🥕 carrot vegetable
🌽 corn
🌶️ hot_pepper spicy chilli
🥔 potato
🥐 croissant breakfast
🍞 bread toast
🥨 pretzel
🧀 cheese
🥚 egg
🍳 fried_egg cooking breakfast
🥞 pancakes breakfast
🥓 bacon
🍔 hamburger burger
🍟 fries chips
🍕 pizza
🌭 hot_dog
🥪 sandwich lunch
🌮 taco
🌯 burrito
🥗 salad healthy
🍝 spaghetti pasta
🍜 ramen noodles
🍲 stew soup
🍣 sushi
🍱 bento lunch
🍚 rice
🍦 ice_cream soft_serve
🍩 doughnut donut
🍪 cookie biscuit
🎂 birthday_cake cake
🍰 cake slice dessert
🧁 cupcake
🍫 chocolate
🍬 candy sweet
🍿 popcorn movie
☕ coffee tea hot drink
🍵 tea green_tea
🥤 cup_straw soda drink
🍺 beer drink
🍻 cheers beers drink
🥂 clinking_glasses toast celebrate champagne
🍷 wine drink
🍸 cocktail drink
🍹 tropical_drink cocktail
🍾 champagne celebrate bottle
🥄 spoon
🍴 fork_knife cutlery eat
🍽️ plate dinner eat
`

const ACTIVITY = `
⚽ soccer football
🏀 basketball
🏈 american_football
⚾ baseball
🎾 tennis
🏐 volleyball
🏉 rugby
🎱 pool billiards
🏓 ping_pong table_tennis
🏸 badminton
⛳ golf
🏹 archery bow
🎣 fishing
🥊 boxing
🛹 skateboard
⛸️ ice_skate
🎿 ski
🏂 snowboard
🏋️ weight_lifting gym
🚴 cycling bike
🏊 swimming swim
🧘 yoga meditate calm
🏆 trophy win prize
🥇 gold_medal first winner
🥈 silver_medal second
🥉 bronze_medal third
🏅 medal
🎖️ military_medal honour
🎫 ticket
🎟️ admission_tickets
🎭 theatre drama masks
🎨 art palette paint
🎬 clapper film movie
🎤 microphone sing karaoke
🎧 headphones music
🎼 score music
🎹 piano keyboard music
🥁 drum
🎸 guitar music
🎻 violin music
🎲 dice game
♟️ chess pawn
🎯 bullseye target goal
🎳 bowling
🎮 video_game controller
🧩 puzzle jigsaw
🎉 tada party celebrate congratulations
🎊 confetti celebrate party
🎈 balloon party birthday
🎁 gift present
🎀 ribbon bow
`

const TRAVEL = `
🚗 car drive
🚕 taxi cab
🚌 bus
🚎 trolleybus
🏎️ racing_car fast
🚓 police_car
🚑 ambulance
🚒 fire_engine
🚚 truck delivery
🚜 tractor
🛵 scooter
🚲 bike bicycle
🛴 kick_scooter
🚆 train rail
🚇 metro subway underground
🚊 tram
✈️ airplane plane flight travel
🛫 departure takeoff flight
🛬 arrival landing flight
🚀 rocket launch ship
🛸 ufo flying_saucer
🚁 helicopter
⛵ sailboat boat
🚢 ship cruise
⚓ anchor
⛽ fuel petrol gas
🚦 traffic_light
🗺️ map world
🧭 compass direction
🏔️ mountain snow
⛰️ mountain_peak
🌋 volcano
🏕️ camping tent
🏖️ beach holiday vacation
🏝️ island holiday
🏜️ desert
🏟️ stadium
🏠 house home
🏡 house_garden home
🏢 office building work
🏥 hospital
🏦 bank
🏨 hotel
🏫 school
🏭 factory
🏰 castle
🗼 tower tokyo
🗽 statue_of_liberty new_york
⛪ church
🌍 globe_europe_africa world earth
🌎 globe_americas world earth
🌏 globe_asia world earth
🌐 globe internet web
🌅 sunrise morning
🌇 sunset evening
🌃 night_city stars
`

const OBJECTS = `
⌚ watch time
📱 phone mobile
💻 laptop computer
⌨️ keyboard
🖥️ desktop computer monitor
🖨️ printer print
🖱️ mouse_device
💾 floppy save disk
💿 cd disc
📷 camera photo
🎥 movie_camera video
📺 tv television
📻 radio
⏰ alarm_clock wake time
⏳ hourglass waiting time
⏱️ stopwatch timer
🔋 battery
🔌 plug power
💡 bulb idea light
🔦 flashlight torch
🕯️ candle
🗑️ wastebasket bin trash delete
💵 dollar money cash
💶 euro money
💷 pound money
💰 money_bag
💳 credit_card pay
🧾 receipt invoice
✉️ envelope mail email letter
📧 email mail
📨 incoming_envelope mail
📩 envelope_arrow send
📤 outbox sent
📥 inbox received
📦 package parcel box delivery
📫 mailbox post
📝 memo note write
📄 page document
📃 page_curl document
📑 bookmark_tabs
📊 bar_chart stats graph
📈 chart_up growth increase
📉 chart_down decline decrease
📅 calendar date
📆 tear_off_calendar date schedule
🗓️ spiral_calendar date
📇 card_index contacts
📋 clipboard list
📁 folder
📂 open_folder
🗂️ dividers
📰 newspaper news
📓 notebook
📕 closed_book book
📖 open_book read
📚 books library study
🔖 bookmark
📎 paperclip attachment
🖇️ linked_paperclips
📐 triangular_ruler
📏 ruler
✂️ scissors cut
🖊️ pen
🖋️ fountain_pen
✏️ pencil edit
🔍 magnifier search find
🔎 magnifier_right search
🔒 lock locked secure
🔓 unlock open
🔑 key password
🔨 hammer build
🛠️ tools fix
⚙️ gear settings
🔧 wrench fix
🧰 toolbox
🧲 magnet
🧪 test_tube experiment science
🔬 microscope science
🔭 telescope
💊 pill medicine
🩹 plaster bandage
🚪 door
🛏️ bed sleep
🛋️ couch sofa
🚿 shower
🧹 broom clean
🧺 basket laundry
🧻 toilet_paper
🧼 soap wash
🛒 cart shopping
👓 glasses
👔 necktie shirt formal
👕 tshirt
👟 sneaker shoe
🎒 backpack school
👑 crown king queen
💍 ring wedding
💎 gem diamond
🔔 bell notification
🔕 bell_off mute
📣 megaphone announce
📢 loudspeaker announce
`

const SYMBOLS = `
❤️ heart love red
🧡 orange_heart love
💛 yellow_heart love
💚 green_heart love
💙 blue_heart love
💜 purple_heart love
🖤 black_heart
🤍 white_heart
🤎 brown_heart
💔 broken_heart sad
❣️ heart_exclamation
💕 two_hearts love
💞 revolving_hearts love
💓 beating_heart love
💗 growing_heart love
💖 sparkling_heart love
💘 heart_arrow cupid love
💝 heart_ribbon gift love
💯 hundred perfect score
💢 anger
💬 speech_bubble comment chat
💭 thought_bubble thinking
💤 zzz sleep
✅ check_mark done yes tick complete
☑️ checkbox done tick
✔️ check tick yes
❌ cross_mark no wrong x
❎ cross_button no
➕ plus add
➖ minus subtract
➗ divide
✖️ multiply times
❓ question
❔ white_question
❗ exclamation important
❕ white_exclamation
‼️ double_exclamation
⁉️ interrobang what
⚠️ warning caution alert
🚫 prohibited forbidden no
⛔ no_entry stop
🔴 red_circle
🟠 orange_circle
🟡 yellow_circle
🟢 green_circle
🔵 blue_circle
🟣 purple_circle
⚫ black_circle
⚪ white_circle
🟥 red_square
🟩 green_square
🟦 blue_square
⬆️ arrow_up
⬇️ arrow_down
⬅️ arrow_left
➡️ arrow_right next
↗️ arrow_upper_right
↘️ arrow_lower_right
↩️ arrow_return back reply
🔄 arrows_counterclockwise refresh sync
🔁 repeat loop
🔀 shuffle
▶️ play
⏸️ pause
⏹️ stop_button
⏭️ next_track skip
🆕 new
🆗 ok
🆒 cool
🆓 free
🔝 top
🔜 soon
♻️ recycle
©️ copyright
®️ registered
™️ trademark
ℹ️ information info
#️⃣ hash number
🏁 chequered_flag finish
🚩 red_flag flag warning
🏳️ white_flag surrender
🏴 black_flag
`

function parse(category: string, source: string): Emoji[] {
  return source.trim().split('\n').map((line) => {
    const [emoji, code, ...tags] = line.trim().split(' ')
    return { emoji: emoji!, name: code!.replace(/_/g, ' '), shortcodes: [code!], tags: tags.map(tag => tag.replace(/_/g, ' ')), category }
  })
}

export const EMOJI_CATEGORIES: EmojiCategory[] = [
  { id: 'smileys', label: 'Smileys', icon: 'i-lucide-smile', items: parse('smileys', SMILEYS) },
  { id: 'people', label: 'People', icon: 'i-lucide-hand', items: parse('people', PEOPLE) },
  { id: 'nature', label: 'Nature', icon: 'i-lucide-leaf', items: parse('nature', NATURE) },
  { id: 'food', label: 'Food', icon: 'i-lucide-utensils', items: parse('food', FOOD) },
  { id: 'activity', label: 'Activity', icon: 'i-lucide-trophy', items: parse('activity', ACTIVITY) },
  { id: 'travel', label: 'Travel', icon: 'i-lucide-plane', items: parse('travel', TRAVEL) },
  { id: 'objects', label: 'Objects', icon: 'i-lucide-lightbulb', items: parse('objects', OBJECTS) },
  { id: 'symbols', label: 'Symbols', icon: 'i-lucide-heart', items: parse('symbols', SYMBOLS) }
]

export const EMOJI: Emoji[] = EMOJI_CATEGORIES.flatMap(category => category.items)

/**
 * The emoji a few typed letters mean, best first: the name starting with
 * them, then a word of the name, then a keyword, then anywhere at all
 */
export function searchEmoji(query: string, limit = 64): Emoji[] {
  const term = query.trim().toLowerCase().replace(/[_:]/g, ' ').trim()
  if (!term) return []
  const scored: { item: Emoji, score: number }[] = []
  for (const item of EMOJI) {
    let score = 9
    if (item.name === term) score = 0
    else if (item.name.startsWith(term)) score = 1
    else if (item.name.split(' ').some(word => word.startsWith(term))) score = 2
    else if (item.tags.some(tag => tag === term)) score = 3
    else if (item.tags.some(tag => tag.startsWith(term))) score = 4
    else if (item.name.includes(term) || item.tags.some(tag => tag.includes(term))) score = 5
    if (score < 9) scored.push({ item, score })
  }
  // The sort is stable: within a rank, the order of the picker stands
  return scored.sort((a, b) => a.score - b.score).slice(0, limit).map(entry => entry.item)
}

/** The picker's "Recently used": the newest first, each once, the last 24 */
export function rememberEmoji(recent: string[], emoji: string, keep = 24): string[] {
  return [emoji, ...recent.filter(item => item !== emoji)].slice(0, keep)
}
