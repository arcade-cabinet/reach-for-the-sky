import { createWorld } from 'koota';
import {
  BuildDragTrait,
  CampaignTrait,
  ClockTrait,
  EconomyTrait,
  InspectionTrait,
  MacroTrait,
  OperationsTrait,
  PhaseTrait,
  SettingsTrait,
  TowerTrait,
  ViewTrait,
} from './traits';

export const gameWorld = createWorld(
  PhaseTrait,
  TowerTrait,
  EconomyTrait,
  CampaignTrait,
  MacroTrait,
  OperationsTrait,
  ClockTrait,
  ViewTrait,
  SettingsTrait,
  BuildDragTrait,
  InspectionTrait,
);
