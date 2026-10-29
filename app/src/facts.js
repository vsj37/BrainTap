// A very short fun fact after every round: about the region when we have one, otherwise a neuro pun or a
// neuroscientist story. Keep entries to a sentence or two. Keys are region acronyms from tools/regions.csv.

export const REGION_FACTS = {
  Isocortex: 'The mouse cortex is smooth. The human one is folded, which packs far more surface into the skull.',
  MOB: 'Each olfactory sensory neuron uses just one of roughly a thousand odorant receptor genes, a discovery that won Linda Buck and Richard Axel the 2004 Nobel Prize.',
  AOB: 'The accessory olfactory bulb processes pheromone signals, which many mammals use to read each other.',
  PIR: 'The piriform cortex is the main olfactory cortex, where the signals from the nose are first assembled into smells.',
  HIP: 'In 1953 patient H.M. had parts of his hippocampi removed and could no longer form new memories. His case launched modern memory research.',
  CA1: 'In 1971 John O\'Keefe found "place cells" in the rat hippocampus: neurons that fire only when the animal is in one particular spot. Nobel Prize 2014.',
  CA3: 'CA3 neurons talk to each other a lot. That loop is thought to help the brain complete a whole memory from a partial cue.',
  DG: 'The dentate gyrus is one of the few places where adult mice keep making new neurons.',
  ENT: 'Grid cells, which fire in a hexagonal pattern as an animal moves, were found in the entorhinal cortex in 2005 by May-Britt and Edvard Moser (Nobel 2014).',
  ENTm: 'Grid cells, which fire in a hexagonal pattern as an animal moves, were found here in 2005 by May-Britt and Edvard Moser (Nobel 2014).',
  SUB: 'The subiculum is the hippocampus\'s main exit. Much of what the hippocampus has computed leaves through here.',
  MM: 'The mammillary bodies are linked to memory. They are damaged in Korsakoff syndrome, which is tied to severe thiamine deficiency.',
  fx: 'The fornix is the hippocampus\'s big output cable. Its name comes from the Latin for "arch".',
  cc: 'Roger Sperry studied split-brain patients, whose corpus callosum had been cut, and showed the two hemispheres can act independently (Nobel 1981).',
  VL: 'Cerebrospinal fluid is made in the ventricles. The brain more or less floats in it.',
  V3: 'Cerebrospinal fluid flows through the third ventricle on its way around the brain.',
  CP: 'In mice the caudate and putamen form a single structure. In humans the internal capsule splits them in two.',
  ACB: 'The nucleus accumbens is a hub of reward and motivation. Dopamine from the ventral tegmental area lands here.',
  VTA: 'The ventral tegmental area is a main source of dopamine, the molecule behind motivation and reward learning.',
  SNc: 'Neurons of the substantia nigra make dopamine. Losing them is what causes the movement problems of Parkinson\'s disease.',
  STN: 'Deep brain stimulation of the subthalamic nucleus can calm the tremor of Parkinson\'s disease.',
  TH: 'Almost every sensory signal passes through the thalamus on its way to the cortex. Smell is the famous exception.',
  LGd: 'The dorsal lateral geniculate nucleus relays visual information from the eye to the visual cortex.',
  RT: 'The thalamic reticular nucleus helps generate the sleep spindles you can see on an EEG.',
  LH: 'The lateral habenula is often called the brain\'s "anti-reward" centre. It is active when things turn out worse than expected.',
  HY: 'The hypothalamus runs hunger, thirst, body temperature and sleep, and it is tiny.',
  SCH: 'The suprachiasmatic nucleus is the brain\'s master clock. Light from the eyes keeps it in step with the day.',
  VLPO: 'Neurons in the ventrolateral preoptic nucleus help switch the brain into sleep.',
  ARH: 'The arcuate nucleus holds hunger-driving neurons and reads hormones such as leptin that tell the brain about body fat.',
  PVH: 'The paraventricular hypothalamic nucleus makes oxytocin and vasopressin, hormones that shape bonding and water balance.',
  SO: 'The supraoptic nucleus makes oxytocin and vasopressin and sends them straight to the pituitary gland.',
  SFO: 'The subfornical organ sits outside the blood-brain barrier, so it can sense the blood directly and trigger thirst.',
  AP: 'The area postrema lacks a blood-brain barrier and acts as the brain\'s vomiting trigger for toxins in the blood.',
  LS: 'In 1954 James Olds and Peter Milner found that rats would press a lever again and again to stimulate their septal area, a first clue to the brain\'s reward system.',
  MB: 'The midbrain handles eye movements and orienting, and it hosts the main dopamine-producing neurons.',
  SCs: 'The superior colliculus steers the eyes and head toward whatever just caught your attention.',
  PAG: 'The periaqueductal gray helps orchestrate fight, flight, freezing and pain control.',
  P: 'The pons ("bridge" in Latin) relays signals between the cortex and the cerebellum.',
  MY: 'The medulla keeps you breathing and your heart beating without you thinking about it.',
  LC: 'The locus coeruleus is a main source of noradrenaline. Its name means "blue place".',
  NTS: 'The nucleus of the solitary tract receives signals from the gut, lungs and heart through the vagus nerve.',
  IO: 'The inferior olive sends "climbing fibres" to the cerebellum that signal when a movement did not go as planned.',
  CB: 'In humans the cerebellum holds roughly 80% of all neurons in the brain.',
  CBX: 'The cerebellar cortex is packed with Purkinje cells, huge neurons with branching trees that Ramón y Cajal drew in beautiful detail.',
  CBN: 'Everything the cerebellar cortex computes leaves through the deep cerebellar nuclei.',
  och: 'At the optic chiasm the optic nerves partly cross. In mice about 95% of the fibres cross to the other side.',
  CLA: 'Francis Crick spent his last years studying the claustrum, hoping it held a clue to consciousness.',
  VISp: 'Hubel and Wiesel found that neurons in the primary visual cortex respond to oriented edges (Nobel 1981).',
  'SSp-bfd': 'Each whisker has its own "barrel" of cortex, a neat one-to-one map of the face.',
  MOp: 'Wilder Penfield mapped the human motor cortex in the 1930s-50s and drew the famous "homunculus": the body, rescaled by how much cortex it gets.',
  ACA: 'The anterior cingulate cortex is involved in pain, conflict and effort.',
  PL: 'The prelimbic area is involved in working memory and decision-making.',
  RSP: 'The retrosplenial cortex supports navigation and links memory to space.',
  BLA: 'In fear conditioning, the basolateral amygdala learns that a tone predicts a shock.',
  LA: 'The lateral amygdala is where a neutral tone learns to mean danger in classic fear conditioning.',
  CEA: 'The central amygdala turns fear signals into bodily responses such as freezing and a racing heart.',
};

const PUNS = [
  'A neuron walks into a bar, fires once, and everyone gets the message.',
  'I told my brain a joke about a synapse. It did not get it: no connection.',
  'Neurons that fire together wire together. Neurons that do not simply ghost each other.',
  'I would tell you a dopamine joke, but I am saving it for the reward.',
  'My favourite neuron joke has a very long axon. It takes a while to get to the point.',
  'Brain puns are a lot of grey matter.',
  'Why did the neuron cross the synapse? To get to the other side, in about a millisecond.',
  'Never argue with a neuron. It will just keep firing back.',
];

const STORIES = [
  'Santiago Ramón y Cajal drew neurons by hand and showed that the brain is made of separate cells. He shared the 1906 Nobel Prize with Camillo Golgi, whose stain he used.',
  'In 1848 an iron rod passed through the frontal lobe of railway worker Phineas Gage. He survived, and his case became a classic hint that the frontal lobes matter for personality.',
  'Korbinian Brodmann split the cortex into 52 areas in 1909 just by looking at how its cells are arranged. We still use his numbers.',
  'Otto Loewi said the idea for his experiment on chemical nerve signals came to him in a dream, in 1921. He won the Nobel Prize for it in 1936.',
  'Hodgkin and Huxley worked out how nerve impulses travel by recording from the giant axon of a squid (Nobel 1963).',
  'Rita Levi-Montalcini discovered nerve growth factor, partly with experiments in a makeshift lab in her bedroom during the war (Nobel 1986).',
  'Brenda Milner showed that patient H.M. could still learn new motor skills, proving the brain has more than one kind of memory.',
  'Hubel and Wiesel found that visual neurons prefer edges when a glass slide edge moved across the screen and a neuron suddenly fired.',
  'A mouse brain has about 70 million neurons. A human brain has about 86 billion.',
  'The slices in this game come from the Allen Mouse Brain Atlas, built by slicing and imaging whole brains to map gene activity everywhere.',
  'Nerve signals in fast myelinated axons can travel over 100 metres per second.',
];

const hash = (s) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
};

// -> { kind: 'Fun fact' | 'Neuro pun' | 'Neuroscientist story', text }. Same inputs, same result.
export function factFor(key, seed = '') {
  if (REGION_FACTS[key]) return { kind: 'Fun fact', text: REGION_FACTS[key] };
  const n = hash(`${seed}|${key}`);
  return n % 2 ? { kind: 'Neuro pun', text: PUNS[(n >>> 1) % PUNS.length] } : { kind: 'Neuroscientist story', text: STORIES[(n >>> 1) % STORIES.length] };
}
