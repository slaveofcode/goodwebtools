/**
 * Word lists for Daily Word Guess — curated, bundled, strict.
 *
 * Each list is a space-separated blob (compact, gzip-friendly) split at module
 * load. ANSWERS are the possible daily/random answers; EXTRA words are valid
 * guesses that will never be the answer. A unit test enforces shape (5
 * lowercase a–z letters), uniqueness, and minimum sizes.
 */

const EN_ANSWERS_RAW = `
abide about above admit adobe adopt adult again agent agree ahead aisle
alarm album alert alike alive allow alloy alone along altar amber amend
among ample angel anger angle angry ankle apart apple apply apron arbor
ardor arena argue arise armor aroma array arrow aside asset audio audit
avoid awake award aware awful axiom bacon badge baker balmy banjo barge
basic basin batch baton beach beady beard beast began begin begun being
below bench berry bigot bilge birch birth bison black blade blame bland
blank blast blaze bleak bleat bleed blend bless blimp blind blink bliss
blitz block bloke blond blood bloom blown blues blunt blurb blurt blush
board boast bogus boost booth boots bosom bossy botch bough bound bowed
bowel boxer boxes brace braid brain brake brand brass brave bread break
breed brick bride brief brine bring brink brisk broad broil broke brook
broom broth brown brush brute buggy build built bulbs bulky bully bunch
bunny burly burnt burst buses bushy butch buyer cabin cable cameo candy
canoe canon cargo carol carry carve catch cause cease cedar chain chair
chalk charm chart chase cheap check cheek cheer chess chest chick chief
child chill chime choir choke chord chore chose chunk churn cider cigar
cinch circa cited civil claim clamp clang clash clasp class clean clear
cleat cleft clerk click cliff climb cling clink cloak clock close cloth
cloud clout clown cluck clump clung coach coast cobra cocoa colon color
comet comic comma conch condo coral could count court cover crack craft
cramp crane crank crash crate craze crazy cream credo creed creek creep
crept crest crime crisp croak crock crone crony crook cross crowd crown
crude cruel crumb crush crust crypt cubic cumin curly curse curve cycle
cynic daddy daily dairy daisy dance dandy datum daunt dealt debit debut
decay decor decoy defer deity delay delta delve demon denim dense depth
derby devil diary digit diner dingo dingy diode dirge dirty disco ditch
ditto ditty diver dizzy dodge doing dolly donor donut dough dozen draft
drain drake drama drank drape drawl drawn dread dream dress dried drier
drift drill drink drive droll droop drops drove drown drunk dryer dusky
dusty dutch dwarf dwell dwelt dying eager eagle early earth easel eaten
eater ebony edict edify eerie egret eight eject elbow elder elect elite
elope elude email embed ember emote empty enact ended enemy enjoy ennui
ensue enter entry envoy epoch equal equip erase erect erode error essay
ether ethic evade event every evict evoke exact exalt excel exert exile
exist expel extol extra exult fable facet faint fairy faith false fancy
farce fatal fault fauna favor feast feign felon femur fence feral ferry
fetal fetch fever fewer fiber field fiend fiery fifth fifty fight filch
filed files filly films final finch first fishy fixed fjord flack flail
flair flake flaky flame flank flare flash flask fleck fleet flesh flick
flier fling flint flirt float flock flood floor flora floss flour flout
flown fluff fluid fluke flung flunk flush flute foamy focal focus foggy
folio folly foray force forge forgo forte forth forty forum found foyer
frail frame frank fraud freak freed fresh fried frill frisk frock frond
front frost froth frown froze fruit fudge fully fumes fungi funky funny
furor furry fussy fuzzy gaffe gamer gauge gaunt gauze gavel gawky gecko
geeky geese genie genre ghost ghoul giant giddy girth given giver gizmo
glade gland glare glass glaze gleam glean glide glint gloat globe gloom
glory gloss glove gnash gnome godly going goner goody gooey goofy goose
gorge gouge gourd grace grade graft grain grand grant grape graph grasp
grass grate grave gravy graze great greed green greet grief grill grime
grimy grind gripe groan groin groom grope gross group grout grove growl
grown gruel gruff grunt guard guava guess guest guide guild guilt guise
gulch gully gumbo guppy gusto gusty gypsy habit hairy halve handy happy
hardy harem haste hasty hatch hater haunt haven havoc hazel heady heard
heart heath heave heavy hedge hefty heist helix hello hence heron hilly
hinge hippo hitch hoard hobby hoist holly homer honey honor horde horse
hotel hound house hovel hover howdy human humid humor hunch hurry husky
hutch hydro hyena icing ideal idiom idiot idols image imply inbox incur
index inept inert infer ingot inlay inlet inner input irony issue itchy
ivory jaunt jazzy jerky jetty jewel jiffy joint joist joker jolly joust
judge juice juicy jumbo junky karma kayak kebab khaki kinky kiosk kitty
knack knead kneel knelt knife knock knoll known koala kudos label labor
laced lacks lanky lapel larch large larva lasso latch later latte laugh
layer leach leafy leaky leant leapt learn lease leash least leave ledge
leech lefty legal lemon lemur level lever light liken lilac limbo limit
linen lingo lipid liter lithe liver livid llama loamy loath lobby local
locus lodge lofty logic login loopy loose lorry loser lotus louse lousy
loyal lucid lucky lumen lumpy lunar lunch lunge lurch lurid lusty lying
lyric macaw macho macro madam magic magma maize major maker mambo mango
mania manic manor maple march marry marsh mason match maxim maybe mayor
mealy meant meaty medal media medic melee melon merry messy metal meter
metro micro midge midst might milky mimic mince miner minor minty minus
mirth miser missy modal model modem moist molar moldy money month moody
moose moral morph mossy motel motif motor motto mound mount mourn mouse
mouth mover movie mower mucky muddy mulch mummy munch mural murky mushy
music musky musty muted nacho naive nanny nasal natty naval navel needy
neigh nerve never newer newly niche nifty night ninja ninny ninth noble
noise noisy nomad noose north notch novel nudge nurse nutty nylon oaken
oasis occur octal octet odder oddly offal offer often olive omega onion
onset opera opine optic orbit order organ other otter ought ounce outdo
outer ovary owing owned oxide ozone paddy pagan paint paler palsy panel
panic pansy pants papal paper parch parka party pasta paste pasty patch
patio patty pause paved paver pawed peace peach pearl pecan pedal penal
pence penny perch peril perky pesky pesto petal petty phase phone phony
photo piano picky piece piety piggy pilot pinch pined pinky pinto piper
pique pitch pithy pivot pixel pixie pizza place plaid plain plank plead
pleat plied plier pluck plumb plume plump plush point poise poker polar
polka pooch poppy porch poser posit posse pouch pound power prank prawn
preen press price prick pride pried prime primo print prior prism privy
prize probe prone prong proof props prose proud prove prowl proxy prune
psalm pudgy puffy pulpy pulse punch pupil puppy puree purge pushy putty
quack quark quart quash queen queer quell query quest queue quick quiet
quill quilt quirk quite quota quote rabbi rabid raced racer radar radio
rainy raise rally ranch range rapid ratio rayon razor react ready realm
rebel recap recur reeds reedy refer regal reign relax relay relic remit
renal renew repay repel reply rerun reset resin retro retry reuse revel
rhino rhyme rider ridge rifle right rigid rigor rinse ripen risen riser
risky rival river rivet roast robin robot rocky rodeo rogue roomy roost
rotor rouge rough round rouse route rover rowdy royal ruddy ruler rumba
rumor rupee rural rusty sable sadly safer saint salad sally salon salsa
salty sandy saner sappy sassy satin sauce sauna savor savvy scald scale
scalp scaly scamp scant scarf scary scene scent scoff scold scone scoop
scoot scope score scorn scour scout scowl scram scrap screw scrub scuba
scuff sedan seedy sense sepia serif serum serve setup seven sever sewer
shack shade shady shaft shake shaky shale shall shame shape shard share
shark sharp shave shawl sheaf shear sheen sheep sheer sheet shelf shell
shift shine shiny shire shirk shirt shoal shock shone shook shoot shore
short shout shove shown showy shred shrew shrub shrug shunt shush shyly
sight sigma silky silly since sinew singe siren sixth sixty skate skier
skiff skill skimp skirt skull skunk slack slain slang slant slash slate
slave sleek sleep sleet slept slice slick slide slime slimy sling slink
slope slosh sloth slump slung slurp slush slyly smack small smart smash
smear smell smile smirk smite smith smock smoke smoky snack snail snake
snaky snare snarl sneak sneer snide sniff snipe snoop snore snort snout
snowy snuck snuff soapy sober soggy solar solid solve sonar sonic sooty
sorry sound south space spade spare spark spasm spawn speak spear speck
speed spell spend spent spice spicy spied spiel spike spill spine spiny
spire spite splat split spoil spoke spoof spook spool spoon spore sport
spout spray spree sprig spurn spurt squad squat squid stack staff stage
staid stain stair stake stale stalk stall stamp stand stank staph stare
stark start stash state stave stead steak steal steam steed steel steep
steer stein stern stick stiff still stilt sting stink stint stock stoic
stoke stole stomp stone stony stood stool stoop store stork storm story
stout stove strap straw stray strip strut stuck study stuff stump stung
stunt style suave sugar suite sulky sully sumac sunny super surge sushi
swami swamp swarm swath swear sweat sweep sweet swell swept swift swill
swine swing swipe swirl swish swoon swoop sword swore sworn swung synod
syrup tabby table taboo tacit tacky taffy taint taken taker tally talon
tamer tango tangy taper tapir tardy tarot taste tasty tatty taunt tawny
teach teary tease teddy teeth tempo tenet tenor tense tenth tepee tepid
terse thank theft their theme there these thick thief thigh thing think
third thong thorn those three threw throb throw thrum thumb thump thyme
tiara tibia tidal tiger tight tilde timer timid tipsy titan title toast
today token tonal tonic tooth topaz topic torch torso total totem touch
tough towel tower toxic toxin trace track tract trade trail train trait
tramp trash treat trend triad trial tribe trice trick tried tries tripe
trite troll troop trope trout trove truce truck truly trump trunk truss
trust truth tryst tulip tulle tumor tunic turbo tutor twang tweak tweed
tweet twice twine twirl twist tying udder ulcer ultra umber uncle uncut
under undue unfed unfit unify union unite unity unlit untie until unzip
upper upset urban urine usage usher usual utter vague valet valid valor
value valve vapid vapor vault vegan venom venue verge verse verso verve
vicar video vigil vigor villa vinyl viola viper viral virus visit visor
vista vital vivid vixen vocal vodka vogue voice vowel vying wacky wafer
wager wagon waist waltz warty waste watch water waver waxen weary weave
wedge weedy weigh weird welsh wench whack whale wharf wheat wheel whelp
where which whiff while whine whiny whirl whisk white whole whoop whose
widen wider width wield wince winch windy wiser wispy witch witty woken
woman women woody wooly woozy wordy world worry worse worst worth would
wound woven wrack wrath wreak wreck wrest wring wrist write wrong wrote
wrung wryly yacht yearn yeast yield yodel yokel young yours youth yummy
zebra zesty zonal
`;

const EN_EXTRA_RAW = `
abbey abhor abode abort acorn adage adept adieu adore aegis aerie affix
afire afoot agape agate agave agile aging aglow agony aired alamo alder
algae alias alibi align allay alley allot aloft amaze amble amiss amity
amply amuse anise annul anode antic anvil aorta apace aphid aping apish
apter areal argon argot arose ashen askew aspic assay atoll atoms atone
attic aught aural avail avert avian awash azure bagel banns baron baste
bayou befit beige beret berth beset betel bevel bezel bicep bidet bight
blare bolas bonny boric bosky boule bourn bovid briar brunt buxom cabal
cacao cache cadet cadre carat catty caulk chafe chaff champ chant chaos
chard chary chasm chert chide chive chock chomp cilia clank colza conic
copse creel cress crick crimp croup deign depot deter dogma dowdy drone
drool erupt ethyl evert flume fount friar gaudy geode gnarl gorse grail
grebe hoary honed humus igloo irate junta juror krill laden ladle lager
lance lapis lathe levee liege lifer litre loner manna mercy merit mocha
nadir newel nosed nymph odium oriel parry parse phial phlox pious plait
poach podgy prate pseud pubes quaff quail qualm quirt raspy retch ritzy
rosin roust saber salvo sedge segue siege sieve skulk soupy spume stoup
strum surly swank sward sylph thine trawl tread tress twain usurp veldt
waive whelm whorl
`;

const ID_ANSWERS_RAW = `
antar
arang
arsip
aspal
atlas
badai
badan
bagus
bahas
bakar
bakau
bakso
balik
bantu
barat
basah
batal
bebas
belas
belia
benar
benda
beres
biasa
bibir
bijak
bikin
bilik
bisik
bodoh
bosan
buana
buang
buaya
bukan
bukit
bulan
bulat
bunga
bunuh
bunyi
bursa
buruh
buruk
busuk
butuh
cabai
cadas
cagar
cakap
calon
campu
candu
capai
carik
carut
catat
cemas
cepat
cerah
cerai
cerna
ceruk
cewek
cicak
cicip
cinta
cleng
cocok
codet
comel
curah
dalam
damai
danau
dasar
datar
dayak
dekat
delik
derap
deras
derma
desak
desir
detak
detil
dikit
disko
doang
dodol
dolar
dosis
duduk
dunia
duren
empat
etnik
fabel
fajar
falak
fikir
filem
fizik
fokus
frase
gagak
gagap
galak
galer
ganas
ganda
ganja
gapai
garis
gelar
gelas
gemar
gemuk
genap
gener
genit
genta
gerak
gerbu
getah
gilir
gincu
graha
gubuk
gugup
gulai
gulma
gumam
gusur
hakim
halus
harta
hasil
helai
hemat
hewan
hidro
hidup
hijau
hilir
himne
hisap
hitam
hokum
hutan
idola
ilham
imbas
impas
incar
indek
indra
induk
infaq
ingat
injak
insan
intan
intro
irama
ironi
jabat
jahit
jalur
jaman
jambu
jarak
jatuh
jebol
jelas
jelma
jemur
jenuh
jepit
jeruk
jodoh
joged
jorah
joran
jujur
jumpa
kabar
kabau
kabel
kabul
kacau
kader
kadet
kakus
kalam
kalbu
kalem
kalor
kapal
kapok
kapur
karib
kasih
kasus
katak
katun
kawal
kawin
kedai
kedip
kejar
kelir
kenal
keran
keras
kerat
kerja
kesan
kesat
ketam
kilau
kipas
kirim
kisah
kista
kitab
klaim
klien
kodok
kolam
kolom
koper
koran
kotor
kuasa
kubah
kubur
kukuh
kulit
kumal
kumat
kunci
kursi
kutip
lacak
lahar
lamar
lampu
landa
laris
lasak
lawan
lebah
lebar
lebat
leher
lekat
lelap
lemah
lemas
lembu
lepas
lepet
lerai
lesuh
lezat
lidah
lihai
lihat
lokal
loket
lomba
luber
ludes
lukis
lumba
lurah
luruh
lurus
lutut
mahal
mahar
mahir
makam
makan
makna
malam
malas
mandi
manis
marah
marga
masak
masam
massa
masuk
matur
medis
megah
merah
merak
merdu
mesin
migas
mimpi
minum
mirah
misal
mitra
mobil
mohon
monas
mufak
mujur
mulai
mulut
murah
musik
musim
mutan
nafas
nagih
najis
nanti
napas
nasib
nenas
nikah
nilai
nisan
nobel
nomor
nyala
nyata
nyeri
ombak
opini
oprak
opsir
optim
orang
pacar
padat
paham
pahat
pahit
pakai
paket
paksa
pamit
panas
panci
panen
panik
papan
parad
parah
paras
pasar
pasir
pasti
pasuk
patin
patuh
pekal
pekat
pelan
penuh
penyu
perak
peras
pergi
perih
perlu
pesan
petak
petir
piara
pijak
piket
pikir
pilih
pinda
pipih
pipit
pohon
polah
polos
posel
posko
praja
prima
prosa
pukat
pukul
pulau
pulsa
puluh
punya
purba
pusar
pusat
puspa
quran
rafia
ragam
rahim
rajut
ramai
ramal
ranah
randu
rangs
rasio
ratus
rawat
rayap
razia
rebut
redam
redup
remah
remed
renda
resep
reses
resmi
restu
retak
reviu
ribut
ricuh
rigen
rikuh
rimba
riset
riyal
robek
rokok
rompi
rotan
ruang
rucah
ruder
rujak
rukun
rusak
rusuh
sabar
sabot
sabuk
sabun
sadar
sadis
safir
saham
sahih
sajak
salam
salap
salju
salur
samud
sangk
santi
sapat
sapon
sasak
sasar
satir
sawan
sawer
sebab
sedap
sedih
seduh
sehat
sekit
selok
selur
semai
semak
sendi
senja
serat
serba
serig
sesak
sesud
setia
siaga
sibuk
sigap
sikap
silat
silau
sinis
sipil
sipir
siram
sirih
sirup
siswa
sitar
situs
siung
skala
sobek
sodor
sohor
sonik
stupa
subuh
sulit
sumbu
sunah
sunat
sunyi
supel
surat
surau
surga
surut
susah
susul
sutra
tabib
tabik
tabir
tabor
tagih
tahun
takut
talen
taman
tanda
tante
tapal
tarif
tarik
taruh
tatar
tawar
tawon
tegas
tegur
tekor
telan
telur
teman
tenda
tenis
tenun
tepat
terap
teras
teror
tibur
tidur
tikar
timah
timba
timur
tinja
tinju
tipis
titip
tokoh
tolok
tomat
topik
totok
tuang
tugas
tukar
tunda
tupai
turis
turun
tutup
tuyul
udang
ujung
ulang
undur
upaya
usaha
usang
ustad
usung
utama
utang
utara
versi
visum
vokal
wabah
wahid
wajah
wajar
wajib
wakaf
wakil
walau
wangi
waras
warna
wasir
wasta
wedus
welas
wiras
wisma
wudhu
wujud
yakin
yudis
zaman
zenit
`;

const ID_EXTRA_RAW = `
abadi
absen
aktif
alang
andai
aneka
anjur
antre
apung
artis
asing
bakmi
balok
balon
bambu
bapak
bedil
bekal
belok
betul
bibit
bidak
bijih
biksu
bivak
botak
bukti
bulak
buron
cacah
dapur
debar
dekil
dewan
dusta
eksis
emisi
etnis
fiksi
firma
fisik
fosil
gagal
galon
garpu
gerus
gesit
getir
gibah
gubal
gudeg
gugur
gusar
hadap
hafal
hajar
hajat
halal
hantu
haram
heboh
heksa
hilal
iblis
ihram
iklan
iklim
ilahi
imbau
imbuh
indah
infak
infra
inter
islah
islam
jadul
jamin
jarum
jatah
jawab
judes
kabin
kagum
kanal
kapas
karam
kayuh
kekar
keong
kerah
keset
ketik
ketua
kilat
kimia
korup
kuota
kurva
kusut
lahan
lahir
lajur
laksa
lapuk
latah
lebur
leceh
lelah
letih
letup
libur
licik
limau
lirih
mabuk
mamut
mayat
mercu
mesiu
mesra
mewah
micin
mikro
milik
minat
mukim
mulia
muram
murka
nanas
ngilu
obrol
obyek
paraf
pasca
payah
pekan
pesat
pijat
pisau
pleno
poros
premi
pucat
pucuk
pudar
pupuk
putra
putri
putus
qunut
rabun
racun
rakit
raung
rawan
rehat
rindu
ritme
rubel
sakit
tolak
`;

export const EN_ANSWERS = EN_ANSWERS_RAW.trim().split(/\s+/);
export const EN_EXTRA = EN_EXTRA_RAW.trim().split(/\s+/);
export const ID_ANSWERS = ID_ANSWERS_RAW.trim().split(/\s+/);
export const ID_EXTRA = ID_EXTRA_RAW.trim().split(/\s+/);

export interface WordSets {
  /** Ordered list — indexed for the deterministic daily pick. */
  answers: string[];
  /** Membership set for guess validation (answers + extra guesses). */
  valid: Set<string>;
}

export function wordSets(lang: 'en' | 'id'): WordSets {
  const answers = lang === 'id' ? ID_ANSWERS : EN_ANSWERS;
  const extra = lang === 'id' ? ID_EXTRA : EN_EXTRA;
  return { answers, valid: new Set([...answers, ...extra]) };
}
