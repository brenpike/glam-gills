import type { Point, SafeArea } from './zone';

/** A Collection Book fact card. */
export interface FactCard {
  id: string;
  name: string;
  title: string;
  body: string;
  /** Collection Book hint while the card is not found; absent means the habitat rule decides. */
  unfoundHint?: string;
}

/** The tilapia fact card, shown the first time the axolotl meets a tilapia. */
export const TILAPIA_FACT: Readonly<FactCard> = Object.freeze({
  id: 'tilapia',
  name: 'Tilapia',
  title: 'Meet the tilapia',
  body: 'Tilapia are fish that people brought to Xochimilco. They do not belong there. They eat axolotl eggs and food.',
});

/**
 * The boy or girl fact card, always found in the Collection Book (PRD C14).
 * Source: Animal Diversity Web, https://animaldiversity.org/accounts/Ambystoma_mexicanum/
 */
export const BOY_OR_GIRL_FACT: Readonly<FactCard> = Object.freeze({
  id: 'boyOrGirl',
  name: 'Boy or girl?',
  title: 'Boy or girl?',
  body: 'Grown-up boy axolotls are longer and slimmer, with a bigger bump by the back legs. Girls are rounder and plumper.',
});

/**
 * The plastic worm fact card, shown the first time the axolotl meets a plastic worm (PRD C13).
 * Source (owner to review): NOAA Marine Debris Program, https://marinedebris.noaa.gov/why-marine-debris-problem/ingestion
 */
export const PLASTIC_WORM_FACT: Readonly<FactCard> = Object.freeze({
  id: 'plastic-worm',
  name: 'Plastic worm',
  title: 'Plastic is not food',
  body: 'Bits of plastic in the water can look like food. Animals sometimes eat them by mistake, and it makes them feel sick. Keeping rubbish out of the water helps.',
});

/**
 * The heron fact card, shown the first time the axolotl meets a heron (PRD C13).
 * Sources, checked 2026-10-22 (web research only; the game fetches nothing):
 * National Audubon Society, Guide to North American Birds, Great Egret,
 * https://www.audubon.org/field-guide/bird/great-egret ("Forages mostly by standing or walking in
 * shallow water, waiting for fish to come near, then catching them with rapid thrust of bill");
 * National Audubon Society, Guide to North American Birds, Great Blue Heron,
 * https://www.audubon.org/field-guide/bird/great-blue-heron ("Forages mostly by standing still or
 * walking very slowly in shallow water, waiting for fish to swim near, then striking with a rapid
 * thrust of the bill.");
 * Ramos, Mena, Schneider and Zambrano, "Movement ecology of captive-bred axolotls in restored and
 * artificial wetlands: Conservation insights for amphibian reintroductions and translocations",
 * PLoS One 20(4):e0314257 (2025), https://doi.org/10.1371/journal.pone.0314257 (read as
 * https://pmc.ncbi.nlm.nih.gov/articles/PMC12043180/, checked 2026-11-06 by web research only, issue
 * #217; site: a chinampa in the chinampa-refuge project in Xochimilco; "After the study concluded
 * in Xochimilco, we observed a great egret (Ardea alba) capturing an axolotl from the canal."; "Great
 * egrets are present in both study areas and are classified as migratory birds"). This is the bird
 * of the Audubon Great Egret source above; the card's text does not change.
 * "Axolotls are safer down deep, away from the surface" is the game's rule (the heron's stab
 * reaches only so deep, ADR 0019), not checked against a source.
 * Owner to verify: the quotes' exact wording on the page (read through a page summarizer), and
 * "live around", since the study calls great egrets migratory.
 */
export const HERON_FACT: Readonly<FactCard> = Object.freeze({
  id: 'heron',
  name: 'Heron',
  title: 'Meet the heron',
  body: "Herons are tall birds that live around Xochimilco's canals. They stand very still and watch the water for food. Axolotls are safer down deep, away from the surface.",
});

/**
 * The ghost net fact card, shown the first time the axolotl meets a ghost net (PRD C13).
 * Sources (owner to verify): NOAA Marine Debris Program, "Increasing the Efficiency of Locating and
 * Removing Ghost Nets in the Upper Great Lakes",
 * https://marinedebris.noaa.gov/removal/increasing-efficiency-locating-and-removing-ghost-nets-upper-great-lakes
 * (ghost nets "can continue to entrap fish, other marine life, and even waterfowl"; a ghost net
 * removal program in Lake Superior) ; NOAA Marine Debris Program, "Removing and Preventing Derelict
 * Fishing Gear and Large Debris Nationwide",
 * https://marinedebris.noaa.gov/removal/removing-and-preventing-derelict-fishing-gear-and-large-debris-nationwide
 * (derelict gear "continues to entangle, trap, and kill marine animals after it is lost in the
 * environment"; removal from "our ocean and waterways"). Neither page names canals.
 */
export const GHOST_NET_FACT: Readonly<FactCard> = Object.freeze({
  id: 'ghost-net',
  name: 'Ghost net',
  title: 'Lost fishing nets',
  body: 'Old fishing nets that get lost in the water can tangle up animals. People pull them out of canals and lakes to keep animals safe.',
});

/**
 * The garter snake fact card, shown the first time the axolotl meets a garter snake (PRD C13).
 * Sources, checked 2026-10-23 (web research only; the game fetches nothing):
 * Manjarrez, Pacheco-Tinoco and Venegas-Barrera, "Intraspecific variation in the diet of the
 * Mexican garter snake Thamnophis eques", PeerJ 5:e4036 (2017), https://doi.org/10.7717/peerj.4036
 * (read as https://www.ebi.ac.uk/europepmc/webservices/rest/PMC5691781/fullTextXML; snakes sampled
 * at 23 sites on the Mexican Plateau; "This snake forages in vegetative cover along the shore";
 * "an attack may include a sudden lunge across the surface toward prey"; prey mostly fish, then
 * leeches, earthworms, frogs and tadpoles);
 * Manjarrez, Rivas-Gonzalez, Venegas-Barrera and Moyaho, "Visual Detection of Speckles in the Fish
 * Xenotoca variata by the Predatory Snake Thamnophis melanogaster in Water of Different Turbidity",
 * PLoS ONE 10(6):e0129429 (2015), https://doi.org/10.1371/journal.pone.0129429 (read as
 * https://www.ebi.ac.uk/europepmc/webservices/rest/PMC4465328/fullTextXML; T. melanogaster is
 * "endemic to the highlands of central Mexico" and "a specialist aquatic species in its diet and
 * foraging technique underwater");
 * The Reptile Database, Thamnophis melanogaster,
 * https://reptile-database.reptarium.cz/species?genus=Thamnophis&species=melanogaster (distribution
 * lists Distrito Federal, now Mexico City).
 * Owner to verify: "good swimmers" (the sources say they forage underwater, not how well they
 * swim); "Axolotls are safer down deep" is the game's rule (the snake strikes from the surface),
 * not checked against a source; garter snakes in Xochimilco itself, not checked.
 */
export const GARTER_SNAKE_FACT: Readonly<FactCard> = Object.freeze({
  id: 'garter-snake',
  name: 'Garter snake',
  title: 'Meet garter snakes',
  body: 'Garter snakes live near water in Mexico and are good swimmers. They hunt small animals near the surface. Axolotls are safer down deep.',
});

/**
 * The water hyacinth fact card, shown the first time the axolotl meets the hyacinth mats (PRD C13).
 * Sources, checked 2026-10-23 (web research only; the game fetches nothing):
 * Carrion, Ponce-de Leon, Cram, Sommer, Hernandez and Vanegas (UNAM), "Aprovechamiento potencial
 * del lirio acuatico (Eichhornia crassipes) en Xochimilco para fitorremediacion de metales",
 * Agrociencia 46(6), 2012,
 * https://www.scielo.org.mx/scielo.php?script=sci_arttext&pid=S1405-31952012000600007 (a pest "in
 * the canals of the Xochimilco Protected Natural Area"; it "se extiende rapidamente y forma tapetes
 * o esteras"; it "disminuye la entrada de luz y merma el oxigeno disuelto en el agua");
 * IUCN SSC Invasive Species Specialist Group, Global Invasive Species Database, Eichhornia crassipes,
 * https://www.iucngisd.org/gisd/species.php?sc=70 (populations "known to double in as little as 12
 * days"; "These mats shade out native submersed plant species");
 * Excelsior, "Arranca limpieza de canales en Xochimilco", 2020-08-31,
 * https://www.excelsior.com.mx/comunidad/arranca-limpieza-de-canales-en-xochimilco/1403028
 * (Xochimilco borough crews clear aquatic weeds from the canals by hand, with harvesters where the
 * water hyacinth is thickest);
 * LOS40 Mexico, "Con hechos, la Alcaldia Xochimilco recupera sus canales y genera empleos temporales
 * para la comunidad", 2025-06-27,
 * https://los40.com.mx/2025/06/27/con-hechos-la-alcaldia-xochimilco-recupera-sus-canales-y-genera-empleos-temporales-para-la-comunidad/
 * (the borough removed more than 200 cubic metres; in the rainy season it grows unchecked, blocks
 * the water and harms its oxygen).
 * Owner to verify: the clearing sources are news reports, not a CONABIO or borough page.
 */
export const WATER_HYACINTH_FACT: Readonly<FactCard> = Object.freeze({
  id: 'water-hyacinth',
  name: 'Water hyacinth',
  title: 'Water hyacinth',
  body: 'Water hyacinth is a floating plant that grows very fast. In Xochimilco it can cover the canals and block the light. People clear it out to keep the water healthy.',
});

/**
 * The common carp fact card, shown the first time the axolotl meets a carp (PRD C13).
 * Sources, checked 2026-10-24 (web research only; the game fetches nothing):
 * Zambrano, Valiente and Vander Zanden, "Food web overlap among native axolotl (Ambystoma mexicanum)
 * and two exotic fishes: carp (Cyprinus carpio) and tilapia (Oreochromis niloticus) in Xochimilco,
 * Mexico City", Biological Invasions 12(9):3061-3069 (2010), doi:10.1007/s10530-010-9697-8 (read as
 * the FAO AGRIS record https://agris.fao.org/search/en/records/65dfea8f0f3e94b9e5dd96ab; carp and
 * tilapia were brought to Xochimilco for aquaculture more than 20 years earlier and now dominate it)
 * for "people brought to Xochimilco";
 * IUCN SSC Invasive Species Specialist Group, Global Invasive Species Database, Cyprinus carpio,
 * https://www.iucngisd.org/gisd/species.php?sc=60 (adults feed by "sucking up mud from the bottom";
 * feeding "churns up the sediments on the bottom of the water", "resulting in increased siltation
 * and bioturbidity") for "dig in the mud for food and make the water cloudy";
 * National Geographic Kids, "Axolotl", https://kids.nationalgeographic.com/animals/amphibians/facts/axolotl
 * (carp and tilapia "compete with axolotls for food and also eat axolotl eggs") and The Wildlife
 * Society, "Creating refuges for axolotls in Mexico City", 2021-12-06,
 * https://wildlife.org/creating-refuges-for-axolotls-in-mexico-city/ ("carp will feed on axolotl
 * eggs") for "They also eat axolotl eggs".
 * Owner to verify: the egg claim rests on these two secondary sources; no primary study of carp
 * eating axolotl eggs in Xochimilco was found. "Big fish" is not checked against a size source.
 */
export const CARP_FACT: Readonly<FactCard> = Object.freeze({
  id: 'carp',
  name: 'Common carp',
  title: 'Meet the carp',
  body: 'Common carp are big fish that people brought to Xochimilco. They dig in the mud for food and make the water cloudy. They also eat axolotl eggs.',
});

/**
 * The crayfish fact card, shown the first time the axolotl meets a crayfish (PRD C13; issue #77,
 * ND-14). The body is the owner's (issue #77, owner interrogation, 2026-10-22).
 * Sources, checked 2026-10-27 (web research only; the game fetches nothing):
 * Helfrich and DiStefano, Virginia Cooperative Extension, "Sustaining America's Aquatic Biodiversity -
 * Crayfish Biodiversity and Conservation", publication 420-524, https://pubs.ext.vt.edu/420/420-524/420-524.html
 * ("Like its saltwater cousin, the lobster"; "Many spend most of their lives walking on stream and
 * lake bottoms (largely at night)"; "When threatened, the crayfish assumes a defensive position
 * with the body lifted and the claws elevated and spread");
 * The Australian Museum, "Crayfish", https://australian.museum/learn/animals/crustaceans/crayfish/
 * ("They forage on the stream bed").
 * Owner to verify: "small" is not checked against a size source; "to warn other animals" reads the
 * source's defensive position as a warning; "Axolotls stay safe by swimming up and away" is the
 * game's rule (the crayfish reaches only along the floor), not checked against a source.
 */
export const CRAYFISH_FACT: Readonly<FactCard> = Object.freeze({
  id: 'crayfish',
  name: 'Crayfish',
  title: 'Meet the crayfish',
  body: 'Crayfish are small cousins of lobsters that walk along the bottom. They open their claws wide to warn other animals. Axolotls stay safe by swimming up and away.',
});

/**
 * The black bass fact card, shown the first time the axolotl meets a black bass (PRD C13; issue
 * #78). The title and body are the owner's (issue #78, owner interrogation, 2026-10-22).
 * Sources, checked 2026-10-30 (web research only; the game fetches nothing):
 * Zambrano (responsible), Instituto de Biologia, UNAM, "Abundancia y estructura poblacional del
 * axolotl (Ambystoma mexicanum) en los sistemas dulceacuicolas de Xochimilco y Chalco", final report
 * of CONABIO project AS004, 2004, http://www.conabio.gob.mx/institucion/proyectos/resultados/InfAS004.pdf
 * ("La carpa, la tilapia y la lobina son especies introducidas con muy altas densidades dentro de
 * Xochimilco y Chalco"; "la lobina (Micropterus salmoides) es una especie tipicamente depredadora
 * que puede estar reduciendo las poblaciones de ajolotes por depredacion directa de juveniles") for
 * "people brought to Xochimilco";
 * U.S. Geological Survey, Nonindigenous Aquatic Species, "Largemouth Bass (Micropterus nigricans) -
 * Species Profile", https://nas.er.usgs.gov/queries/FactSheet.aspx?SpeciesID=401 (native to the St.
 * Lawrence and Great Lakes, Hudson Bay and Mississippi River basins, the Atlantic Slope and "the Gulf
 * Slope drainages from southern Florida into northern Mexico"; "Size: 97 cm"; "Largemouth Bass are
 * voracious feeders"; "They feed predominately by sight") for "from far away" and "big fish".
 * Owner to verify: "black bass" reads the report's "lobina" (Micropterus salmoides, the largemouth
 * bass, now Micropterus nigricans); "from far away" reads the native range, which reaches northern
 * Mexico but not the Valley of Mexico; "hunt fast in open water" is not checked against a source (the
 * USGS profile ties the bass to shorelines, vegetation and submerged structure); "Axolotls stay safe
 * by swimming out of the way" is the game's rule (the bass lunges only straight), not checked against
 * a source.
 */
export const BLACK_BASS_FACT: Readonly<FactCard> = Object.freeze({
  id: 'black-bass',
  name: 'Black bass',
  title: 'Meet the black bass',
  body: 'Black bass are big fish that people brought to Xochimilco from far away. They hunt fast in open water. Axolotls stay safe by swimming out of the way.',
});

/**
 * The cormorant fact card, shown the first time the axolotl comes within CORMORANT_MEET_RANGE of a
 * cormorant, outside the Home Spot (PRD C13; issue #112, PRD open question 549, ND-6). Provisional copy.
 * Source, checked 2026-10-29 (web research only; the game fetches nothing): National Audubon Society,
 * Neotropic Cormorant, https://www.audubon.org/field-guide/bird/neotropic-cormorant ("Forages by diving
 * from surface and swimming underwater, propelled mostly by feet"; colour tags Black and Brown).
 * No source places the Neotropic cormorant in Xochimilco, so the card does not claim that. "Axolotls
 * stay safe by swimming deep or away" is the game's rule (the dive goes only so deep), not checked
 * against a source.
 */
export const CORMORANT_FACT: Readonly<FactCard> = Object.freeze({
  id: 'cormorant',
  name: 'Cormorant',
  title: 'Meet the cormorant',
  body: 'Cormorants are dark water birds that dive from the surface. They swim underwater by kicking with their feet. Axolotls stay safe by swimming deep or away.',
});

/**
 * The pelican fact card, shown the first time the axolotl comes within PELICAN_MEET_RANGE of a
 * pelican line, outside the Home Spot (PRD C13; issue #211, ND-20). Provisional copy.
 * Sources, checked 2026-11-05 (web research only; the game fetches nothing):
 * Milenio, "Cientos de pelícanos llegan a Xochimilco para refugiarse del frío extremo de EU y
 * Canadá", 2025-02-11,
 * https://amp.milenio.com/politica/comunidad/pelicanos-llegan-a-xochimilco-para-refugiarse-frio-extremo-eu-canada
 * (Pelecanus erythrorhynchos, the American white pelican, from the Great Lakes region between Canada
 * and the United States, October to March; more than 700 in the Ejidos de Xochimilco y San Gregorio
 * Atlapulco protected area, about 200 of them at the Parque Ecológico de Xochimilco wetland; "Algunas
 * aves forman grupos y al unísono clavan sus picos al agua") for "Hundreds", "in winter" and
 * "dip their bills together";
 * National Audubon Society, Guide to North American Birds, American White Pelican,
 * https://www.audubon.org/bird-guide-api/1469 ("Forages by swimming on surface, dipping bill into
 * water and scooping up fish in pouch"; "May forage cooperatively, lining up and driving fish toward
 * shallower water"; "does not dive from the air for fish") for "float in a line" and "scoop up fish";
 * Findholt and Anderson 1995, Colonial Waterbirds 18(1):58-68 (the diet of American white pelicans
 * nesting at Pathfinder Reservoir, Wyoming; tiger salamanders, Ambystoma tigrinum, with carp and white
 * suckers among the top prey), why the line is a danger to an axolotl; the card never says a
 * pelican eats an axolotl. "Axolotls stay safe by swimming down deep" is the game's rule (the scoop
 * goes only so deep), read from Audubon's surface feeding, not a source claim.
 */
export const PELICAN_FACT: Readonly<FactCard> = Object.freeze({
  id: 'pelican',
  name: 'White pelican',
  title: 'Meet the pelican',
  body: 'Hundreds of white pelicans fly to Xochimilco in winter. They float in a line and dip their bills together to scoop up fish. Axolotls stay safe by swimming down deep.',
});

/**
 * The stalactite fact card, shown the first time the axolotl meets a dripping stalactite (PRD C13;
 * issue #77, ND-3). Provisional copy.
 * Sources, checked 2026-10-28 (web research only; the game fetches nothing):
 * National Park Service, Mammoth Cave National Park, "Stalactites, Stalagmites, and Cave Formations",
 * https://www.nps.gov/maca/learn/nature/stalactites-stalagmites-and-cave-formations.htm
 * ("icicle-shaped deposits that form when water dissolves overlying limestone"; "Stalactites form
 * along ceilings and hang downward"; "When stalactites are actively forming, they drip water";
 * "Both the calcite and gypsum formations in Mammoth Cave took thousands of years to form");
 * National Park Service, "Growing Speleothems", https://www.nps.gov/subjects/caves/growing-speleothems.htm
 * (calcite comes out of the dripping water onto cave ceilings, walls and floors).
 * Owner to verify: "a tiny bit of rock" reads the sources' calcite left by the water; "very slowly"
 * reads "thousands of years" for the whole cave's formations, not a growth rate for one stalactite.
 */
export const STALACTITE_FACT: Readonly<FactCard> = Object.freeze({
  id: 'stalactite-drip',
  name: 'Stalactite',
  title: 'Stalactites',
  body: 'Stalactites hang from cave roofs like rock icicles. Each drip of water leaves a tiny bit of rock behind, so they grow very slowly.',
});

/**
 * The geyser fact card, shown the first time the axolotl meets a geyser vent (PRD C13; issue #77,
 * ND-3). Provisional copy, about cold-water geysers, since the spring cave is cold, clear water.
 * Sources, checked 2026-10-28 (web research only; the game fetches nothing):
 * Geysir Andernach, "How does an eruption of the Geysir Andernach work?",
 * https://www.geysir-andernach.de/en/geysir/funktionsweise/ (the carbon dioxide "comes from the
 * magma deep beneath the Eifel"; the water is "20 to 25° Celsius"; "The entire geyser eruption lasts
 * about 15 minutes", and "110 to 120 minutes later" "the well is full and the next geyser eruption
 * begins"; "all cold-water geysers require an artificial connection from the earth's surface to the
 * depths");
 * Guinness World Records, "Tallest cold-water geyser",
 * https://www.guinnessworldrecords.com/world-records/highest-cold-water-geyser (the Geysir Andernach
 * in Germany; carbon dioxide from deep underground dissolves in cold groundwater and pushes it out of
 * a drilled well, like a soda bottle);
 * F. J. Gouveia and S. J. Friedmann, Lawrence Livermore National Laboratory, "Timing and prediction
 * of CO2 eruptions from Crystal Geyser, UT", UCRL-TR-221731, 2006,
 * https://digital.library.unt.edu/ark:/67531/metadc890957/ (Crystal Geyser in Utah erupts carbon
 * dioxide and water again and again, 140 eruptions in a 76-day record).
 * Owner to verify: "cold" reads the sources' "cold-water" geysers, whose water is 20 to 25° C at
 * Andernach, cool beside a hot spring's, not icy; "fizzy gas" and "like in soda" read the sources'
 * carbon dioxide; the Guinness and Crystal Geyser details were read through page summaries, not the
 * full text; the sources' cold-water geysers burst from wells people drilled, and up into the air,
 * while the game's vent is in a cave and bursts up under water.
 */
export const GEYSER_FACT: Readonly<FactCard> = Object.freeze({
  id: 'geyser-vent',
  name: 'Geyser',
  title: 'Geysers',
  body: 'Some geysers are cold. Fizzy gas from deep underground builds up in the water, like in soda, and pushes it out. Then the geyser rests and fills up.',
});

/**
 * The anchor fact card, shown the first time the axolotl meets an anchor drop (PRD C13; issue #194,
 * owner Q1 to Q3 of 2026-11-01). The title and body are approved by the owner (2026-11-01, PRD open
 * question 592).
 * Sources, checked 2026-11-01 (web research only; the game fetches nothing):
 * Wikipedia, "Anchor", https://en.wikipedia.org/wiki/Anchor (an anchor is "a device, normally made of
 * metal, used to secure a vessel to the bed of a body of water to prevent the craft from drifting due
 * to wind or current"; the rode "can be made of rope, chain or a combination of rope and chain"; a
 * deadweight anchor "relies solely on being a heavy weight"; "The weight of the anchor chain can be
 * more than that of the anchor"; "to weigh anchor" is "to lift the anchor from the sea bed, allowing
 * the ship or boat to move");
 * Boat-ed (Kalkomey Enterprises), "Anchoring Your Boat", West Virginia Boater Safety Course,
 * https://www.boat-ed.com/westvirginia/studyGuide/Anchoring-Your-Boat/10105201_50537/ ("slowly lower
 * the anchor over the bow to the bottom");
 * Boat-ed (Kalkomey Enterprises), "Retrieving an Anchor", New York Boater Safety Course,
 * https://www.boat-ed.com/newyork/studyGuide/Retrieving-an-Anchor/10103501_41541/ ("Move the boat
 * directly over the anchor while pulling in the line. Pulling the anchor straight up should break it
 * free.").
 * The owner checked these points with the wording on 2026-11-01: "heavy" reads Wikipedia's deadweight anchor and chain weight, not every anchor;
 * "on a chain" reads the rode of rope, chain or both; "the canal bed" reads the sources' bed or
 * bottom of a body of water, as no source names canals or Xochimilco, and whether Xochimilco's
 * boaters use anchors is not checked; "holds the boat still" reads "secure a vessel" and "prevent
 * the craft from drifting"; "pull it back up" reads "to weigh anchor" and the Boat-ed retrieving step.
 */
export const ANCHOR_DROP_FACT: Readonly<FactCard> = Object.freeze({
  id: 'anchor-drop',
  name: 'Anchor',
  title: 'Anchors',
  body: 'Boaters lower a heavy anchor on a chain down to the canal bed. It holds the boat still. When it is time to go, they pull it back up.',
});

/**
 * The mud seep fact card, shown the first time the axolotl meets a mud seep (PRD C13; issue #194,
 * owner Q1 to Q3 of 2026-11-01). The title and body are approved by the owner (2026-11-01, PRD open
 * question 593).
 * Sources, checked 2026-11-01 (web research only; the game fetches nothing):
 * U.S. Geological Survey, "WaterWords-Methanogen", 2019-06-15,
 * https://www.usgs.gov/news/waterwords-methanogen (a methanogen is a microbe that produces methane,
 * found in wetlands among other places; "Methanogens help break down organic material in low oxygen
 * environments");
 * U.S. Geological Survey, "Marsh Gas" (image), https://www.usgs.gov/media/images/marsh-gas ("Bubbles
 * of methane, also known as marsh gas, created by methanogens");
 * Douglas Fox, Science News Explores, "Strange lake belches flammable gas in the high Arctic",
 * 2019-04-25, https://www.snexplores.org/article/strange-lake-belches-flammable-gas-high-arctic
 * ("single-celled microbes have begun dining on those plant remains"; "They break down the dead
 * stuff into mush, like kitchen scraps in a compost heap"; the microbes "exhale methane"; bubbles
 * "shoved their way up" "through the mud at the bottom of the lake" and "streamed up, popping at the
 * surface");
 * Wikipedia, "Wetland methane emissions", https://en.wikipedia.org/wiki/Wetland_methane_emissions
 * ("Most methanogenesis, or methane production, occurs in oxygen-poor environments"; plants "provide
 * much of the carbon needed for methane producing processes in wetlands"; bubbles come from "methane
 * building up over time in the soil, forming pockets of methane gas").
 * The owner checked these points with the wording on 2026-11-01: "tiny living things, too small to see" reads the sources' microbes and
 * single-celled microbes; "canal mud" reads wetland soil and lake-bottom mud, as no source names
 * canals or Xochimilco; "old leaves and plants" reads organic material and plant remains; "full of"
 * is not checked against a count; in the Science News Explores lake the plant-eating microbes are in
 * thawing permafrost and the bubbling gas may come from a buried coal bed, so no one source shows the
 * whole chain from plants in mud to bubbles; the Wikipedia bubbles are released into the air, not
 * described rising through water.
 */
export const MUD_SEEP_FACT: Readonly<FactCard> = Object.freeze({
  id: 'mud-seep',
  name: 'Mud seep',
  title: 'Mud bubbles',
  body: 'Canal mud is full of tiny living things, too small to see. They break down old leaves and plants and make gas that rises up as bubbles.',
});

/**
 * The underwater springs fact card, shown the first time the axolotl meets a pulsing current (PRD
 * C13; issue #105, the owner's text of 2026-10-22, ND-14).
 * Sources, checked 2026-10-28 (web research only, read through search summaries; the game fetches
 * nothing):
 * Lucia Mouat, The Christian Science Monitor, "Mexico's Floating Gardens", 1992-02-21,
 * https://www.csmonitor.com/1992/0221/21101.html (the canals were "once fed by crystal springs";
 * a resident says the springs were tapped for Mexico City's drinking water in 1952);
 * Wikipedia, "Lake Xochimilco", https://en.wikipedia.org/wiki/Lake_Xochimilco (the lake was fed by
 * springs, later piped to supply Mexico City);
 * NSW Department of Education, "Axolotls – food and water",
 * https://education.nsw.gov.au/teaching-and-learning/animals-in-schools/animals-in-schools-species/axolotls/axolotls-food-water
 * (axolotls do best in cool water, about 15 to 18 °C and never above 22 °C, kept clean).
 * Owner to verify: "long ago" reads the springs' tapping in the 1950s; "clean water" reads the
 * sources' "crystal springs"; every source was read through a search summary only, as this
 * session's network could not open the pages.
 */
export const UNDERWATER_SPRINGS_FACT: Readonly<FactCard> = Object.freeze({
  id: 'pulsing-current',
  name: 'Underwater springs',
  title: 'Underwater springs',
  body: "Long ago, springs bubbling up from underground filled Xochimilco's canals with clean water. Axolotls need cool, clean water to stay healthy.",
});

/**
 * The dirty water fact card, shown the first time the axolotl's centre enters a murky patch outside
 * the Home Spot (PRD C13; issue #107, ND-1).
 * Sources, checked 2026-11-02 (web research only; the game fetches nothing):
 * David Alire Garcia (Associated Press), The Christian Science Monitor, "Mythical Mexican axolotl
 * faces extinction in the canals of Xochimilco", 2018-11-20,
 * https://www.csmonitor.com/Environment/2018/1120/Mythical-Mexican-axolotl-faces-extinction-in-the-canals-of-Xochimilco
 * (axolotls are "plagued by polluted water"; as they also take in oxygen through their skin they are
 * "particularly vulnerable to dirty water"; "the raw sewage that pollutes the Xochimilco canals when
 * heavy rains overwhelm the aging pipes");
 * Sarah Freeman, National Geographic, "This fragile wetland is dying. Tour boats could be its
 * unlikely savior.", 2022-01-25,
 * https://www.nationalgeographic.com/travel/article/nanobubbles-tour-boats-could-rescue-endangered-mexican-wetland
 * ("Wastewater is discharged from El Cerro de la Estrella and three smaller treatment plants";
 * "illicit discharges of sewage"; algae blooms "carpet the surface of the water, blocking out sun and
 * oxygen"; "the canals' murkiest depths"; "oxygen-starved waters");
 * U.S. Geological Survey, Water Science School, "Dissolved Oxygen and Water",
 * https://www.usgs.gov/special-topics/water-science-school/science/dissolved-oxygen-and-water
 * ("This dissolved oxygen is breathed by fish and zooplankton and is needed by them to survive";
 * "Bacteria in water can consume oxygen as organic matter decays");
 * U.S. EPA, CADDIS, "Sediments", https://www.epa.gov/caddis/sediments ("Suspended particles can
 * damage gills, resulting in increased susceptibility to low dissolved oxygen").
 * Owner to verify: "rubbish" is not in these sources, which name sewage and wastewater,
 * not litter; "murky" reads National Geographic's "murkiest depths" and the EPA's suspended
 * particles; "harder for animals to breathe" joins two links, low oxygen from decay and blooms and
 * gills harmed by particles, and no source measures either in Xochimilco's canals; "helps axolotls
 * and fish" reads the sources' threats in reverse, not a study of a clean-up.
 */
export const MURKY_WATER_FACT: Readonly<FactCard> = Object.freeze({
  id: 'murky-water',
  name: 'Murky water',
  title: 'Dirty water',
  body: 'When rubbish and dirty water get into the canals, the water turns murky and it is harder for animals to breathe. Keeping the water clean helps axolotls and fish.',
});

/**
 * The fishing lines fact card, shown the first time the axolotl meets a trajinera lure (PRD C13;
 * issue #108). The title and body are the owner's, word for word.
 * Sources: none checked (a web search of 2026-11-03 found no page on axolotls and fishing lines, and
 * did not confirm Mexico's protection of the axolotl; the game fetches nothing).
 * Owner to verify: "People in Xochimilco fish from boats", "A worm on a line can be a trap" and
 * "Axolotls are protected in Mexico" (the protected listing is NOM-059-SEMARNAT, not read here).
 */
export const LURE_FACT: Readonly<FactCard> = Object.freeze({
  id: 'trajinera-lure',
  name: 'Fishing lines',
  title: 'Fishing lines',
  body: 'People in Xochimilco fish from boats. A worm on a line can be a trap, so look up for the line! Axolotls are protected in Mexico, so people should never fish for them.',
});

/**
 * The fishing nets fact card, shown the first time the axolotl meets a drag net (PRD C13; issue
 * #108). The title and body are the owner's, word for word.
 * Sources: none checked (a web search of 2026-11-03 found no page on axolotls caught by mistake in
 * fishing nets; the game fetches nothing).
 * Owner to verify: "Some fishing nets in Xochimilco catch axolotls by mistake", "That is one reason
 * wild axolotls are rare" (the sources found name invasive fish, polluted water and lost habitat
 * as the main threats) and "Safe refuges help them hide".
 */
export const DRAG_NET_FACT: Readonly<FactCard> = Object.freeze({
  id: 'drag-net',
  name: 'Fishing nets',
  title: 'Fishing nets',
  body: 'Some fishing nets in Xochimilco catch axolotls by mistake. That is one reason wild axolotls are rare. Safe refuges help them hide.',
});

/**
 * The punting pole fact card, shown the first time the axolotl meets a punting pole (PRD C13).
 * Sources, checked 2026-10-24 (web research only; the game fetches nothing):
 * Alex Zaragoza, NPR, "In Mexico City, A Technicolor Borough Serves Up Tasty Street Foods - On Water",
 * 2017-01-02 (read as the KPBS reprint
 * https://www.kpbs.org/news/2017/01/02/in-mexico-city-a-technicolor-borough-serves-up; "Xochimilco's
 * famous trajineras - vibrantly painted barges"; a chalupa, a smaller canal boat, is steered "by
 * pushing against the canal floor with a long wooden pole");
 * Sarah Freeman, National Geographic, "This fragile wetland is dying. Tour boats could be its
 * unlikely savior.", 2022-01-25,
 * https://www.nationalgeographic.com/travel/article/nanobubbles-tour-boats-could-rescue-endangered-mexican-wetland
 * ("colorful tour boats known as trajineras, wend along a sun-dappled canal"; "Remeros still make
 * barge poles as their ancestors did"; dead algae "settles at the bottom of the canal as sediment");
 * Ciudades Patrimonio de Mexico, "Xochimilco", https://ciudadespatrimonio.mx/xochimilco/?lang=en
 * ("trajineras ornamentadas"; the chinampas are "anclados al fondo pantanoso", the marshy bottom);
 * Wikipedia, "Xochimilco", https://en.wikipedia.org/wiki/Xochimilco (Xochimilco made "rafts, canoes
 * and trajineras, pushed along the shallow waters by a pole");
 * Wikipedia, "Trajinera", https://en.wikipedia.org/wiki/Trajinera ("a traditional, flat-bottomed
 * wooden rowing boat, suited to the conditions of Lake Xochimilco", cited there to Fodor's).
 * Owner to verify: "flat-bottomed" rests on Wikipedia (its Fodor's source returned 403); the same
 * Wikipedia page says a rower uses an oar, while the other sources describe poles; "the mud" is the
 * sources' canal floor, sediment and marshy bottom. UNESCO World Heritage Centre, "Historic Centre of
 * Mexico City and Xochimilco", https://whc.unesco.org/en/list/412 returned 403 and was not read.
 */
export const PUNTING_POLE_FACT: Readonly<FactCard> = Object.freeze({
  id: 'punting-pole',
  name: 'Punting pole',
  title: 'Trajineras',
  body: 'Trajineras are bright, flat-bottomed boats on the canals of Xochimilco. A boater pushes each one along with a long pole that reaches down to the mud.',
});

/**
 * The tadpole fact card, shown the first time the axolotl meets a tadpole (PRD C13).
 * Sources, checked 2026-10-24 (web research only; the game fetches nothing):
 * The Australian Museum, "Interactive: Frog life cycle, from egg to adult",
 * https://australian.museum/learn/teachers/learning/frog-life-cycle/ ("Most tadpoles hatch from eggs
 * as fully aquatic larvae"; "They breathe through gills and use a long tail to swim"; "Hind legs
 * emerge first, followed by front legs") for the first two sentences;
 * National Geographic Kids, "Axolotl", https://kids.nationalgeographic.com/animals/amphibians/facts/axolotl
 * ("Axolotls eat whatever they can get their jaws on, including mollusks, worms, insect larvae,
 * crustaceans, tadpoles") and Animal Diversity Web, Ambystoma mexicanum (Amy Majchrzak),
 * https://animaldiversity.org/accounts/Ambystoma_mexicanum/ ("axolotls will eat anything that they
 * can catch"; its animal foods list includes amphibians) for the third.
 */
export const TADPOLE_FACT: Readonly<FactCard> = Object.freeze({
  id: 'tadpole',
  name: 'Tadpole',
  title: 'Meet the tadpole',
  body: 'Tadpoles are baby frogs. They swim by wiggling their tails, and they grow legs as they get bigger. Axolotls hunt small water animals like tadpoles.',
});

/**
 * The freshwater shrimp fact card, shown the first time the axolotl meets a shrimp (PRD C13).
 * Sources, checked 2026-10-24 (web research only; the game fetches nothing):
 * The Australian Museum, "Freshwater Shrimp" (Paratya australiensis),
 * https://australian.museum/learn/animals/crustaceans/freshwater-shrimp/ ("five pairs of long thin
 * legs"; it "uses a flick of the tail to move quickly and escape from predators");
 * Derwent Estuary Program, "Species of the Derwent", https://www.derwentestuary.org.au/species/shrimp
 * (the glass shrimp Paratya australiensis has "a vigorous backward-flicking escape response";
 * "Freshwater shrimp live in freshwater creeks and streams") for "zip backward";
 * San Diego Zoo Wildlife Alliance Library, "Diet & Feeding - Axolotl (Ambystoma mexicanum) Fact
 * Sheet", https://ielc.libguides.com/sdzg/factsheets/axolotl/diet (wild adults eat "Small
 * crustaceans") and National Geographic Kids, "Axolotl",
 * https://kids.nationalgeographic.com/animals/amphibians/facts/axolotl (axolotls eat "crustaceans")
 * for the third sentence.
 * Owner to verify: "tiny" (the Australian Museum lists a size of 7 cm); the shrimp sources are
 * Australian species, not species of Xochimilco.
 */
export const SHRIMP_FACT: Readonly<FactCard> = Object.freeze({
  id: 'shrimp',
  name: 'Freshwater shrimp',
  title: 'Freshwater shrimp',
  body: 'Freshwater shrimp are tiny animals with many legs. When something comes near, they flick their tails and zip backward. Axolotls hunt small water animals like these.',
});

/**
 * The axolotl refuges fact card, found on a visit to the refuge (PRD C14).
 * Sources (owner to verify): Tec Science (Tec de Monterrey), "How to Save the mexican Axolotl? Start
 * by Restoring Their Home", 2025-01-31, https://tecscience.tec.mx/en/biotechnology/how-to-save-the-axolotl ;
 * The Wildlife Society, "Creating refuges for axolotls in Mexico City", 2021-12-06,
 * https://wildlife.org/creating-refuges-for-axolotls-in-mexico-city/ (Zambrano et al., Aquatic
 * Conservation, doi:10.1002/aqc.3520).
 */
export const AXOLOTL_REFUGES_FACT: Readonly<FactCard> = Object.freeze({
  id: 'axolotl-refuges',
  name: 'Axolotl refuges',
  title: 'Axolotl refuges',
  body: 'In Xochimilco, people make safe canals for axolotls next to chinampa gardens. Filters of volcanic rock let water in but keep big fish like tilapia out.',
  unfoundHint: 'Visit the refuge to find this card.',
});

/**
 * The canal clean-ups fact card, found on a visit to the refuge once an area is beaten (PRD C14).
 * Sources (owner to verify): EU Delegation to Mexico, "Clean-up activity in Xochimilco, Mexico City,
 * as part of the #EUBeachCleanup campaign", 27.09.2021,
 * https://www.eeas.europa.eu/delegations/mexico/clean-activity-xochimilco-mexico-city-part-eubeachcleanup-campaign_en ;
 * AFP via The Jakarta Post, "Mexican kayaker on mission to clean up floating gardens", 2022-02-04,
 * https://www.thejakartapost.com/culture/2022/02/04/mexican-kayaker-on-mission-to-clean-up-floating-gardens .
 */
export const CANAL_CLEAN_UPS_FACT: Readonly<FactCard> = Object.freeze({
  id: 'canal-clean-ups',
  name: 'Canal clean-ups',
  title: 'Canal clean-ups',
  body: 'People in Xochimilco pull rubbish, like plastic bottles, out of the canals. Keeping the water clean helps keep axolotls safe.',
  unfoundHint: 'Beat an area, then visit the refuge to find this card.',
});

/** The refuge fact cards, in Collection Book order: the axolotl refuges, then the canal clean-ups. */
export const REFUGE_FACT_CARDS: readonly Readonly<FactCard>[] = Object.freeze([AXOLOTL_REFUGES_FACT, CANAL_CLEAN_UPS_FACT]);

/**
 * The refuge fact cards to show now, in REFUGE_FACT_CARDS order: each not yet in `found`, the canal
 * clean-ups card only when `clearedTrashShown` (the refuge shows the trash cleared).
 */
export function refugeFactCardsDue(found: readonly string[], clearedTrashShown: boolean): Readonly<FactCard>[] {
  return REFUGE_FACT_CARDS.filter(
    (card) => !found.includes(card.id) && (clearedTrashShown || card.id !== CANAL_CLEAN_UPS_FACT.id),
  );
}

/** Label of the button that closes a fact card. */
export const FACT_CARD_OK_LABEL = 'OK';

/** Collection Book hint of a fact card not yet found, naming the place to explore. */
export function unfoundFactCardHint(place: string): string {
  return `Explore ${place} to find this card.`;
}

/** Collection Book hint of a fact card not yet found in the canal. */
export const FACT_CARD_UNFOUND_HINT = unfoundFactCardHint('the canal');

/**
 * Centre distance in px within which the axolotl meets a tilapia. Provisional; tune in play.
 * Larger than the tilapia lunge range so the card can show before the first lunge.
 */
export const TILAPIA_MEET_RANGE = 180;

/**
 * Centre distance in px from the heron's position within which the axolotl meets a heron. The heron
 * is always shown (no shadow cycle any more, issue #111). Provisional; tune in play. The same as the
 * tilapia's, and larger than the heron's 110 px reach so the card can show before the first strike.
 */
export const HERON_MEET_RANGE = 180;

/**
 * Centre distance in px from the garter snake's head within which the axolotl meets a garter snake.
 * Provisional; tune in play. The same as the tilapia's and the heron's, and larger than the snake's
 * 110 px lunge range so the card can show before the first dart.
 */
export const GARTER_SNAKE_MEET_RANGE = 180;

/**
 * Centre distance in px within which the axolotl meets a carp (PRD open question 253, ND-6).
 * Provisional; tune in play. The same as the tilapia's, and larger than the carp's 120 px lunge
 * range so the card can show before the first sweep.
 */
export const CARP_MEET_RANGE = 180;

/**
 * Centre distance in px within which the axolotl meets a crayfish (issue #77, ND-14). Provisional;
 * tune in play. The same as the tilapia's, and larger than the crayfish's 90 px lunge range so the
 * card can show before the first pinch.
 */
export const CRAYFISH_MEET_RANGE = 180;

/**
 * Centre distance in px within which the axolotl meets a black bass (issue #78). Provisional; tune in
 * play. The same as the tilapia's, and equal to the bass's 180 px lunge range, so the card shows no
 * later than the first warning.
 */
export const BLACK_BASS_MEET_RANGE = 180;

/**
 * Centre distance in px within which the axolotl meets a cormorant (issue #112, PRD open question
 * 549). Provisional; tune in play. Equal to the cormorant's 180 px lunge range, so the card shows no
 * later than the first warning.
 */
export const CORMORANT_MEET_RANGE = 180;

/**
 * Centre distance in px to a bird of a pelican line within which the axolotl meets the pelicans
 * (issue #211, ND-20). Provisional; tune in play. The same as the cormorant's, so the card can show
 * before the first warning.
 */
export const PELICAN_MEET_RANGE = 180;

/**
 * Distance in px from a pulsing current's band within which the axolotl meets it (issue #105,
 * ND-6). Provisional; tune in play. Short, so the card shows as the axolotl comes up to a vent.
 */
export const PULSING_CURRENT_MEET_RANGE = 60;

/**
 * Distance in px from a murky patch within which the axolotl meets it (issue #107, ND-1): 0, so the
 * card shows when the axolotl's centre first enters a patch.
 */
export const MURKY_WATER_MEET_RANGE = 0;

/**
 * Centre distance in px within which the axolotl meets a trajinera lure (issue #108). Provisional;
 * tune in play.
 */
export const LURE_MEET_RANGE = 120;

/**
 * Centre distance in px within which the axolotl meets a drag net (issue #108). Provisional; tune in
 * play. The same as the tilapia's.
 */
export const DRAG_NET_MEET_RANGE = 180;

/**
 * Centre distance in px from an uncollected tadpole, where it is drawn, within which the axolotl
 * meets a tadpole (PRD open question 276, ND-29). Provisional; tune in play.
 */
export const TADPOLE_MEET_RANGE = 120;

/**
 * Centre distance in px from an uncollected shrimp, where it is drawn, within which the axolotl
 * meets a shrimp (PRD open question 276, ND-29). Provisional; tune in play.
 */
export const SHRIMP_MEET_RANGE = 120;

/**
 * Whether a point lies inside the safe area (inclusive edges). Mirrors zone.ts `inSafeArea` so
 * factCards stays a leaf module with no runtime import: zone.ts loads movingHazards.ts, which
 * reads PUNTING_POLE_FACT from here while this module would still be loading.
 */
function isInSafeArea(point: Point, safeArea: SafeArea): boolean {
  return (
    point.x >= safeArea.x0 && point.x <= safeArea.x1 && point.y >= safeArea.y0 && point.y <= safeArea.y1
  );
}

/**
 * Whether the axolotl at `pos` meets a tilapia: `pos` is outside the safe area (edges count as
 * inside) and some tilapia centre is within `range` (inclusive).
 */
export function meetsTilapia(
  pos: Point,
  tilapias: readonly { pos: Point }[],
  safeArea: SafeArea,
  range = TILAPIA_MEET_RANGE,
): boolean {
  if (isInSafeArea(pos, safeArea)) return false;
  return tilapias.some((tilapia) => Math.hypot(tilapia.pos.x - pos.x, tilapia.pos.y - pos.y) <= range);
}

/**
 * One hazard or predator as the axolotl sees it: its id, its distance in px from the axolotl (as
 * that threat measures it) and the range within which the axolotl meets it.
 */
export interface ThreatSighting {
  id: string;
  distance: number;
  meetRange: number;
}

/**
 * Ids of the threats the axolotl at `pos` meets: none inside the safe area (edges count as inside),
 * else each sighting within its meet range (inclusive), each id once, in sighting order.
 */
export function metThreatIds(pos: Point, safeArea: SafeArea, sightings: readonly ThreatSighting[]): string[] {
  if (isInSafeArea(pos, safeArea)) return [];
  const metIds: string[] = [];
  for (const sighting of sightings) {
    if (sighting.distance <= sighting.meetRange && !metIds.includes(sighting.id)) metIds.push(sighting.id);
  }
  return metIds;
}
