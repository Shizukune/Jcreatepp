/**
 * Machine-readable description of what a Unity item needs to run the generated script.
 * Groundwork for a Unity editor extension (or a PITM exporter); nothing in the app uses it yet.
 *
 * Component names follow Cluster Creator Kit (ClusterVR.CreatorKit.Item.Implements.*).
 * The craft-item limits come from CCK's Runtime/Constants/Constants.cs and the PITM format (pitm.proto).
 */

import type { Program } from './ir';
import { collectUnityRequirements } from './unityRequirements';
import { utf8ByteLength } from './utf8';

/** CCK `Constants.CraftItemScriptableItemMaxSourceCodeByteCount` (UTF-8 bytes). World items have no such check in CCK. */
export const CRAFT_ITEM_SCRIPT_MAX_BYTES = 20_000;

/** Bump when the shape of UnitySetup changes incompatibly. */
export const UNITY_SETUP_FORMAT_VERSION = 1;

export type ItemComponentName =
  | 'Item'
  | 'ScriptableItem'
  | 'MovableItem'
  | 'RidableItem'
  | 'GrabbableItem'
  | 'ItemAudioSetList'
  | 'ItemMaterialSetList'
  | 'WorldItemReferenceList';

export type UnitySetup = {
  format: 'jcreatepp.unity-setup';
  formatVersion: number;
  script: {
    /** UTF-8 byte length (what CCK counts). */
    bytes: number;
    craftItemMaxBytes: number;
  };
  /** Components on the item's root GameObject, in a stable order. Item and ScriptableItem are always present. */
  components: ItemComponentName[];
  /** IDs to register in Item Audio Set List / Item Material Set List / World Item Reference List. */
  audioSetIds: string[];
  materialSetIds: string[];
  worldItemReferenceIds: string[];
  /** Sub nodes (child GameObjects found by name) and the component each one needs. */
  subNodes: { name: string; componentType: string }[];
  /** Things a person has to set up or check by hand (colliders, layers, seat transform, ...). */
  checks: string[];
  /** Combinations that do not work on any item (world or craft). */
  problems: string[];
  /** Reasons this script cannot run as a craft item (empty = no known blocker). */
  craftItemBlockers: string[];
};

const COMPONENT_ORDER: ItemComponentName[] = [
  'Item',
  'ScriptableItem',
  'MovableItem',
  'RidableItem',
  'GrabbableItem',
  'ItemAudioSetList',
  'ItemMaterialSetList',
  'WorldItemReferenceList',
];


export function scriptByteLength(code: string): number {
  return utf8ByteLength(code);
}

export function buildUnitySetup(program: Program, code: string): UnitySetup {
  const components = new Set<ItemComponentName>(['Item', 'ScriptableItem']);
  const audioSetIds = new Set<string>();
  const materialSetIds = new Set<string>();
  const worldItemReferenceIds = new Set<string>();
  const subNodes = new Map<string, { name: string; componentType: string }>();
  const checks = new Set<string>();
  const problems = new Set<string>();
  const craftItemBlockers = new Set<string>();

  for (const requirement of collectUnityRequirements(program)) {
    switch (requirement.kind) {
      case 'movable_item':
        components.add('MovableItem');
        break;
      case 'audio_set':
        components.add('ItemAudioSetList');
        audioSetIds.add(requirement.id);
        break;
      case 'material_set':
        components.add('ItemMaterialSetList');
        materialSetIds.add(requirement.id);
        break;
      case 'world_item_reference':
        components.add('WorldItemReferenceList');
        worldItemReferenceIds.add(requirement.id);
        craftItemBlockers.add(`World Item Reference List（"${requirement.id}" への送信）はワールドのアイテムでしか使えません。`);
        break;
      case 'subnode_component':
        subNodes.set(`${requirement.subNodeName}\u0000${requirement.componentType}`, {
          name: requirement.subNodeName,
          componentType: requirement.componentType,
        });
        // Everything except TextView goes through SubNode.getUnityComponent, which craft items cannot use.
        if (requirement.componentType !== 'TextView') {
          craftItemBlockers.add(`サブノード "${requirement.subNodeName}" の ${requirement.componentType} はクラフトアイテムでは操作できません（文字なら TextView を使ってください）。`);
        }
        break;
      case 'ridable_item':
        components.add('RidableItem');
        checks.add(requirement.reason);
        break;
      case 'grabbable_item':
        components.add('GrabbableItem');
        components.add('MovableItem');
        checks.add(requirement.reason);
        break;
      case 'collision_shape':
        // onCollide fires only for items that move physically.
        components.add('MovableItem');
        checks.add(requirement.reason);
        break;
      case 'event_combination':
        problems.add(requirement.reason);
        break;
      case 'interact_collider':
      case 'overlap_detector':
      case 'send_rate_limit':
      case 'player_detection':
      case 'raycast':
        checks.add(requirement.reason);
        break;
    }
  }

  const bytes = scriptByteLength(code);
  if (bytes > CRAFT_ITEM_SCRIPT_MAX_BYTES) {
    craftItemBlockers.add(`スクリプトが ${bytes} バイトあり、クラフトアイテムの上限 ${CRAFT_ITEM_SCRIPT_MAX_BYTES} バイトを超えています。`);
  }

  return {
    format: 'jcreatepp.unity-setup',
    formatVersion: UNITY_SETUP_FORMAT_VERSION,
    script: { bytes, craftItemMaxBytes: CRAFT_ITEM_SCRIPT_MAX_BYTES },
    components: COMPONENT_ORDER.filter((name) => components.has(name)),
    audioSetIds: [...audioSetIds],
    materialSetIds: [...materialSetIds],
    worldItemReferenceIds: [...worldItemReferenceIds],
    subNodes: [...subNodes.values()],
    checks: [...checks],
    problems: [...problems],
    craftItemBlockers: [...craftItemBlockers],
  };
}

/** One-line size note shown under the generated code (UI text; kept here so it can be tested). */
export function describeScriptSize(bytes: number): { text: string; overCraftItemLimit: boolean } {
  const n = (value: number) => value.toLocaleString('en-US');
  const overCraftItemLimit = bytes > CRAFT_ITEM_SCRIPT_MAX_BYTES;
  const text = overCraftItemLimit
    ? `スクリプトの大きさ: ${n(bytes)} バイト — クラフトアイテムの上限（${n(CRAFT_ITEM_SCRIPT_MAX_BYTES)} バイト）を超えています。ワールドに置くアイテムとしては使えます。`
    : `スクリプトの大きさ: ${n(bytes)} / ${n(CRAFT_ITEM_SCRIPT_MAX_BYTES)} バイト（クラフトアイテムの上限）`;
  return { text, overCraftItemLimit };
}
