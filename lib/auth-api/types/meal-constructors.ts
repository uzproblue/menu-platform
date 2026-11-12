export type MealConstructorOption = {
  id: string;
  menuItemId: string;
  posModifierId: string;
  sortOrder: number;
  menuItemName: string;
};

export type MealConstructorSlot = {
  id: string;
  label: string;
  minPicks: number;
  maxPicks: number;
  sortOrder: number;
  options: MealConstructorOption[];
};

export type MealConstructorHost = {
  id: string;
  hostMenuItemId: string;
  hostMenuItemName: string;
  slotGroups: Array<{
    slotId: string;
    posModifierGroupId: string;
  }>;
};

export type MealConstructor = {
  id: string;
  restaurantId: string;
  name: string;
  active: boolean;
  slots: MealConstructorSlot[];
  hosts: MealConstructorHost[];
  createdAt: string;
  updatedAt: string;
};

export type MealConstructorsListResponse = {
  restaurantId: string;
  constructors: MealConstructor[];
};

export type MealConstructorResponse = {
  constructor: MealConstructor;
};

export type MealConstructorOptionMutation = {
  id?: string;
  menuItemId: string;
  posModifierId: string;
  sortOrder?: number;
};

export type MealConstructorSlotMutation = {
  id?: string;
  label: string;
  minPicks: number;
  maxPicks: number;
  sortOrder?: number;
  options: MealConstructorOptionMutation[];
};

export type MealConstructorHostMutation = {
  id?: string;
  hostMenuItemId: string;
  slotGroups: Array<{
    slotId?: string;
    slotIndex: number;
    posModifierGroupId: string;
  }>;
};

export type MealConstructorMutationBody = {
  id?: string;
  name: string;
  active: boolean;
  slots: MealConstructorSlotMutation[];
  hosts: MealConstructorHostMutation[];
};
