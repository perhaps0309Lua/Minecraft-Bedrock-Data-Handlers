import { Enchantment, EnchantmentType, EntityAttributeComponent, EntityComponentTypes, EntityEquippableComponent, EntityInventoryComponent, EquipmentSlot, ItemComponentTypes, ItemDurabilityComponent, ItemEnchantableComponent, ItemStack, Player, Vector3, world } from "@minecraft/server";
import { EffectDataT, EnchantmentDataT, ItemEffectDataT } from "../types"; // Use our custom types
import { MinecraftFormatCodes, removeFormat } from "./ChatFormat"
import { ItemEffects } from "../titles/ItemEffects";
import { EnchantmentTitles } from "../titles/EnchantmentTitles";
import { safeJsonParser, safeJsonStringify } from "../functions/json";

function debugWarn(functionName: string, message: string, errorStack?: string) {
    console.warn(`[PlayerData.${functionName}] ${message} [${errorStack || "No stack provided."}]`);
}

export class ItemData {
    public item: ItemStack;
    public slot: EquipmentSlot | number | undefined;
    private player: Player;

    // Read only
    protected maxDurability: number = 0;
    public DurabilityComponent: ItemDurabilityComponent | undefined;
    public EnchantableComponent: ItemEnchantableComponent | undefined;
    constructor(item: ItemStack, player: Player, slot?: EquipmentSlot | number) {
        this.item = item;
        this.player = player;
        this.slot = slot; // You need to set the slot for anything besides lore adjustments.

        const itemEnchantments = this.item.getComponent(ItemComponentTypes.Enchantable) as ItemEnchantableComponent;
        const durabilityComponent = this.item.getComponent("durability") as ItemDurabilityComponent;
		if (durabilityComponent) { 
            durabilityComponent.damage = 0;
            this.maxDurability = durabilityComponent.maxDurability;
			this.DurabilityComponent = durabilityComponent;
		}
        
        if (itemEnchantments) {this.EnchantableComponent = itemEnchantments;}
    }

    /**
     * Get a dynamic property from a non-stackable ItemStack
     * @param {string} key - The key of the dynamic property
     * @example
     * const playerStats = itemData.getDynamicProperty("playerStats");
     * if (playerStats) {
     *   console.log(playerStats.health);
     *   console.log(playerStats.attack);
     * }
     * @returns {any}
     */
    public getDynamicProperty(key: string): any {
        let value = this.item.getDynamicProperty(key);
        return safeJsonParser(value);
    }

    /**
     * Set a dynamic property on a non-stackable ItemStack
     * @param {string} key - The key of the dynamic property
     * @param {any} value - The value of the dynamic property
     * @example
     * itemData.setDynamicProperty("playerStats", {health: 20, attack: 10});
     * @returns {void}
     */
    public setDynamicProperty(key: string, value: any): void {
        if (value === undefined) throw Error("Invalid value.");
        if (typeof value === "object") value = safeJsonStringify(value);

        this.item.setDynamicProperty(key, value);
        this.updateItem();
    }

    // Lore functions
    /**
     * Get the lore of the item, returns an array of strings
     * @example const lore = itemData.getLore();
     * console.log(lore);
     * // ["This is a line of lore", "This is another line of lore"]
     * @returns {string[]}
     */
    public getLore(): string[] {
        return this.item.getLore();
    }

    /**
     * Set the lore of the item
     * @param {string[]} lore - The lore to set
     * @example itemData.setLore(["This is a line of lore", "This is another line of lore"]);
     */
    public setLore(lore: string[]): void {
        this.item.setLore(lore);
        this.updateItem();
    }

    /**
     * Add a line of lore to the item
     * @param {string} lore - The lore to add
     * @example 
     * itemData.addLore("This is a line of lore");
     */
    public addLore(lore: string): void {
        const currentLore = this.getLore();
        currentLore.push(lore);
        this.setLore(currentLore);
    }

    /**
     * Remove a line of lore from the item
     * @param {string | number} lore - The lore to remove
     * @example 
     * // Remove the first line of lore
     * itemData.removeLore(0);
     * 
     * // Remove a specific line of lore
     * itemData.removeLore("This is a line of lore");
     * @returns {void}
     */
    public removeLore(lore: string | number): void {
        const currentLore = this.getLore();
        if (typeof lore === "number") {
            currentLore.splice(lore, 1);
        } else {
            const index = currentLore.indexOf(lore);
            if (index !== -1) {
                currentLore.splice(index, 1);
            }
        }

        this.setLore(currentLore);
    }

    // Custom Lore functions

    /**
     * Get the custom lore of the item, returns an object with string or string[] values
     * @example
     * const customLore = itemData.getCustomLore();
     * console.log(customLore);
     * // { "Category": ["This is a line of lore", "This is another line of lore"] }
     * @returns {{ [key: string]: string | string[] }}
     */
    public getCustomLore(): { [key: string]: string | string[] } {
        return this.getDynamicProperty("lore") || {};
    }

    /**
     * Adds custom lore to the item, centered in the middle of the lore with category titles
     * @param {{ [key: string]: string | string[] }} customLore - The custom lore to set
     * @param {string} category - The category of the custom lore
     * @example
     * itemData.addCustomLore("This is a line of custom lore", "LoreCategory");
     * itemData.addCustomLore(["This is a line of custom lore", "This is another line of custom lore"], "LoreCategory");
     * itemData.addCustomLore("This is a line of custom lore"); // Doesn't require categories
     * 
     * // Update the lore
     * itemData.updateLore();
     */
    public addCustomLore(lore: string | string[], category?: string): void {
        let customLore = this.getDynamicProperty("lore") || {};
        const index = typeof lore === "string" ? lore : lore[0];
        customLore[category || index] = lore;
        this.setDynamicProperty("lore", customLore);
    }

    /**
     * Removes custom lore from the item
     * @param {string | string[]} lore - The custom lore to remove
     * @param {string} category - The category of the custom lore to remove
     * @example
     * itemData.removeCustomLore("This is a line of custom lore", "LoreCategory"); // Remove lore inside a category
     * itemData.removeCustomLore("LoreCategory") // Remove the entire category
     * itemData.removeCustomLore("This is a line of custom lore"); // Remove lore without a category
     * 
     * // Update the item to update the lore
     * itemData.updateLore();
     */
    public removeCustomLore(lore: string | string[], category?: string): void {
        let customLore = this.getDynamicProperty("lore") || {};
        const index = typeof lore === "string" ? lore : lore[0];
        delete customLore[category || index];
        this.setDynamicProperty("lore", customLore);
    }

    // Vanilla Enchantment functions
    /**
     * Get the vanilla enchantments of the item, returns an object with EnchantmentDataT values
     * @example
     * const enchantments = itemData.getEnchantments();
     * console.log(enchantments); // [ { type: EnchantmentType, level: number } ] 
     * @returns {Enchantment[]}
     */
    public getEnchantments(): Enchantment[] {
        if (!this.EnchantableComponent) {
            debugWarn("getEnchantments", "Item does not have an enchantable component.");
            return [];
        }

        return this.EnchantableComponent.getEnchantments();
    }

    /**
     * Get a specific vanilla enchantment from the item
     * @param {string} enchantment - The enchantment to get
     * @example
     * const sharpness = itemData.getEnchantment("sharpness");
     * console.log(sharpness); // { type: EnchantmentType, level: number }
     * @returns {EnchantmentDataT}
     */
    public getEnchantment(enchantment: string): Enchantment | undefined {
        if (!this.EnchantableComponent) {
            debugWarn("getEnchantment", "Item does not have an enchantable component.");
            return;
        }

        return this.EnchantableComponent.getEnchantment(enchantment);
    }

    /**
     * Add a vanilla enchantment to the item
     * @param {Enchantment} enchantment - The enchantment to add
     * @example
     * itemData.addEnchantment({ type: new EnchantmentType(MinecraftEnchantmentTypes.FireAspect), level: 1 });
     * @returns {void}
    */
    public addEnchantment(enchantment: Enchantment): void {
        if (!this.EnchantableComponent) {
            debugWarn("addEnchantment", "Item does not have an enchantable component.");
            return;
        }

        this.EnchantableComponent.addEnchantment(enchantment);
        this.updateItem();
    }

    /**
     * Add multiple vanilla enchantments to the item
     * @param {Enchantment[]} enchantments - The enchantments to add
     * @example
     * itemData.addEnchantments([{ type: new EnchantmentType(MinecraftEnchantmentTypes.FireAspect), level: 1 }]);
     * @returns {void}
     * */
    public addEnchantments(enchantments: Enchantment[]): void {
        if (!this.EnchantableComponent) {
            debugWarn("addEnchantments", "Item does not have an enchantable component.");
            return;
        }

        this.EnchantableComponent.addEnchantments(enchantments);
        this.updateItem();
    }

    /**
     * Remove a vanilla enchantment from the item
     * @param {EnchantmentType | string} enchantment - The enchantment to remove
     * @example
     * itemData.removeEnchantment(new EnchantmentType(MinecraftEnchantmentTypes.FireAspect));
     * itemData.removeEnchantment(EnchantmentType.Sharpness);
     * @returns {void}
     */
    public removeEnchantment(enchantment: EnchantmentType | string): void {
        if (!this.EnchantableComponent) {
            debugWarn("removeEnchantment", "Item does not have an enchantable component.");
            return;
        }

        this.EnchantableComponent.removeEnchantment(enchantment);
        this.updateItem();
    }

    /**
     * Remove all vanilla enchantments from the item
     * @example
     * itemData.removeAllEnchantments();
     * @returns {void}
     */
    public removeAllEnchantments(): void {
        if (!this.EnchantableComponent) {
            debugWarn("removeAllEnchantments", "Item does not have an enchantable component.");
            return;
        }

        this.EnchantableComponent.removeAllEnchantments
        this.updateItem();
    } 

    /**
     * Check if the item can have an enchantment
     * @param {Enchantment} enchantment - The enchantment to check
     * @example
     * const canAdd = itemData.canAddEnchantment(EnchantmentType.Sharpness);
     * console.log(canAdd); // true
     * @returns {boolean}
     */
    public canAddEnchantment(enchantment: Enchantment): boolean {
        if (!this.EnchantableComponent) {
            debugWarn("canAddEnchantment", "Item does not have an enchantable component.");
            return false;
        }

        return this.EnchantableComponent.canAddEnchantment(enchantment);
    }

    /**
     * Check if the item has an enchantment
     * @param {EnchantmentType | string} enchantment - The enchantment to check
     * @example
     * const hasEnchantment = itemData.hasEnchantment(EnchantmentType.Sharpness);
     * console.log(hasEnchantment); // true
     * @returns {boolean}
     * */
    public hasEnchantment(enchantment: EnchantmentType | string): boolean {
        if (!this.EnchantableComponent) {
            debugWarn("hasEnchantment", "Item does not have an enchantable component.");
            return false;
        }

        return this.EnchantableComponent.hasEnchantment(enchantment);
    }


    // Enchantment functions
    /**
     * Get the enchantments of the item, returns an object with EnchantmentDataT values
     * @example
     * const enchantments = itemData.getCustomEnchantments();
     * console.log(enchantments); // { "sharpness": { name: "sharpness", level: 1 } }
     * @returns {{ [key: string]: EnchantmentDataT }}
     */
    public getCustomEnchantments(): { [key: string]: EnchantmentDataT } {
        return this.getDynamicProperty("enchantments") || {};
    }

    /**
     * Get a specific enchantment from the item
     * @param {string} enchantment - The enchantment to get
     * @example
     * const sharpness = itemData.getCustomEnchantment("sharpness");
     * console.log(sharpness); // { name: "sharpness", level: 1 }
     * @returns {EnchantmentDataT}
     */
    public getCustomEnchantment(enchantment: string): EnchantmentDataT {
        const enchantments = this.getCustomEnchantments();
        return enchantments[enchantment];
    }

    /**
     * Set the enchantments of the item
     * @param {{ [key: string]: EnchantmentDataT }} enchantments - The enchantments to set
     * @example
     * itemData.setCustomEnchantments({ "sharpness": { name: "sharpness", level: 1 } });
     * @returns {void}
     */
    public setCustomEnchantments(enchantments: { [key: string]: EnchantmentDataT }): void {
        this.setDynamicProperty("enchantments", enchantments);
        this.updateLore();
    }

    /**
     * Add an enchantment to the item
     * @param {EnchantmentDataT} enchantment - The enchantment to add
     * @example
     * itemData.addCustomEnchantment({ name: "sharpness", level: 1 });
     * @returns {void}
     */
    public addCustomEnchantment(enchantment: EnchantmentDataT): void {
        const enchantments = this.getCustomEnchantments();
        enchantments[enchantment.name] = enchantment;

        this.setCustomEnchantments(enchantments);
    }

    /**
     * Remove an enchantment from the item
     * @param {string} enchantment - The enchantment to remove
     * @example
     * itemData.removeCustomEnchantment("sharpness");
     * @returns {void}
     */
    public removeCustomEnchantment(enchantment: string): void {
        const enchantments = this.getCustomEnchantments();
        delete enchantments[enchantment];

        this.setCustomEnchantments(enchantments);
    }

    // Effect functions 
    /**
     * Get the effects of the item, returns an object with EffectDataT values
     * @example
     * const effects = itemData.getEffects();
     * console.log(effects); // { "speed": { name: "speed", level: 1 } }
     * @returns {{ [key: string]: any }}
     */
    public getEffects(): { [key: string]: any } {
        return this.getDynamicProperty("effects") || {};
    }

    /**
     * Set the effects of the item
     * @param {{ [key: string]: any }} effects - The effects to set
     * @example
     * itemData.setEffects({ "speed": { name: "speed", level: 1 } });
     * @returns {void}
     */
    public setEffects(effects: { [key: string]: any }): void {
        this.setDynamicProperty("effects", effects);
    }

    /**
     * Add an effect to the item, you still have to manually setup the item effects (examples in GitHub)
     * @param {ItemEffectDataT} effect - The effect to add
     * @example
     * itemData.addEffect({ name: "speed", level: 1 });
     * @returns {void}
     */
    public addEffect(effect: ItemEffectDataT): void {
        const effects = this.getEffects();
        effects[effect.effect] = effect;

        this.setEffects(effects);
    }

    /**
     * Remove an effect from the item
     * @param {string} effect - The effect to remove
     * @example
     * itemData.removeEffect("speed");
     * @returns {void}
     */
    public removeEffect(effect: string): void {
        const effects = this.getEffects();
        delete effects[effect];

        this.setEffects(effects);
    }

    // Item functions
    /**
     * Set the durability of the item
     * @param {number} durability - The durability to set
     * @example
     * itemData.setDurability(100);
     * @returns {void}
     */
    public setDurability(durability: number): void {
        if (!this.DurabilityComponent) {
            debugWarn("setDurability", "Item does not have a durability component.");
            return;
        }

        this.DurabilityComponent.damage = this.maxDurability - durability;
        this.updateItem();
    }

    /**
     * Get the durability of the item
     * @example
     * const durability = itemData.getDurability();
     * console.log(durability); // 100
     * @returns {number}
     */
    public getDurability(): number {
        if (!this.DurabilityComponent) {
            debugWarn("getDurability", "Item does not have a durability component.");
            return 0;
        }

        return this.maxDurability - this.DurabilityComponent.damage;
    }

    /**
     * Set the damage of the item
     * @param {number} damage - The damage to set
     * @example
     * itemData.setDamage(100); // Will have 100 less hits
     * @returns {void}
     */
    public setDamage(damage: number): void {
        if (!this.DurabilityComponent) {
            debugWarn("setDamage", "Item does not have a durability component.");
            return;
        }

        this.DurabilityComponent.damage = damage;
        this.updateItem();
    }

    /**
     * Get the damage of the item
     * @example
     * const damage = itemData.getDamage();
     * console.log(damage); // 100
     * @returns {number}
     */
    public getDamage(): number {
        if (!this.DurabilityComponent) {
            debugWarn("getDamage", "Item does not have a durability component.");
            return 0;
        }

        return this.DurabilityComponent.damage;
    }

    /**
     * Add damage to the item
     * @param {number} damage - The damage to add
     * @example
     * itemData.addDamage(100); // Will have 100 more hits
     * @returns {void}
     */
    public addDamage(damage: number): void {
        if (!this.DurabilityComponent) {
            debugWarn("addDamage", "Item does not have a durability component.");
            return;
        }

        this.DurabilityComponent.damage += damage;
        this.updateItem();
    }

    /**
     * Repair the item, sets the durability to the max durability
     * @example
     * itemData.repairItem();
     * @returns {void}
     */
    public repairItem(): void {this.setDurability(0);}


    // Dynamic property functions
    /**
     * Update the item, this is required after setting dynamic properties
     * @returns 
     * @example 
     * this.setDynamicProperty("playerStats", { health: 20, attack: 10 });
     * this.updateItem();
     * // When you get the item, it returns a copy of the item, so you need to update the item in the player's inventory
     */
    public updateItem(): void {
        if (this.slot === undefined) return;

        const inventory = this.player.getComponent(EntityComponentTypes.Inventory) as EntityInventoryComponent;
        const container = inventory?.container;
        const playerEquipment = this.player.getComponent(EntityComponentTypes.Equippable) as EntityEquippableComponent;

        if (!container || !playerEquipment) return;

        if (typeof this.slot === "number") {
            container.setItem(this.slot, this.item);
        } else {
            playerEquipment.setEquipment(this.slot, this.item);
        }
    }

    /**
     * Update the lore of the item, this is required after setting custom lore, enchantments, or effects
     * @returns 
     * @example 
     * this.addCustomLore("This is a line of custom lore", "LoreCategory");
     * this.updateLore(); 
     * // When you get the item, it returns a copy of the item, so you need to update the item in the player's inventory
     * @returns {void}
     */
    public updateLore(): void {
        const longestText = "Has Custom Properties";
        let enchantments = this.getCustomEnchantments();

        // Remove the old lore
        this.setLore([]);

        // Get custom item lore data with spaces saved for centering
        let customLore = this.getDynamicProperty("lore") || {}; // either category with an array of strings or a string
        for (const key in customLore) {
            let currentLore = customLore[key];
            if (typeof currentLore === "string") {
                const displayLength = removeFormat(currentLore).length;
                const displaySpaces = longestText.length - displayLength;
                const newTitle = " ".repeat(Math.floor(displaySpaces / 2 + 0.5) + 3) + currentLore;
                this.addLore(newTitle);
            } else {
                this.addLore(" ".repeat(Math.floor(longestText.length / 2 + 0.5) + 3) + MinecraftFormatCodes.BOLD + key + MinecraftFormatCodes.RESET)
                currentLore.forEach((line: string) => {
                    const displayLength = removeFormat(line).length;
                    const displaySpaces = longestText.length - displayLength;
                    const newTitle = " ".repeat(Math.floor(displaySpaces / 2 + 0.5) + 3) + line;
                    this.addLore(newTitle);
                });
            }
        }

        let enchantmentSpacing = longestText.length - ("Enchantments".length);
        this.addLore(" ".repeat(Math.floor(enchantmentSpacing / 2) + 1) + MinecraftFormatCodes.BOLD + "Enchantments" + MinecraftFormatCodes.RESET)
        for (const enchantment in enchantments) {
            const enchantmentData = enchantments[enchantment];
            const enchantmentTitle = EnchantmentTitles[enchantmentData.name] || enchantmentData.name + "-failed"

            const displayLength = removeFormat(enchantmentTitle + " " + enchantmentData.level).length;
            const displaySpaces = longestText.length - displayLength;
            const newTitle = " ".repeat(Math.floor(displaySpaces / 2 + 0.5) + 3) + enchantmentTitle + " " + enchantmentData.level;
            this.addLore(newTitle);
        }

        // Item Effects
        const effects = this.getEffects(); // return if no effects
        if (Object.keys(effects).length === 0) return;

        let effectSpacing = longestText.length - ("Effects".length);
        this.addLore(" ".repeat(Math.floor(effectSpacing / 2) + 1) + MinecraftFormatCodes.BOLD + "Effects" + MinecraftFormatCodes.RESET);

        for (const effect in effects) {
            const effectData = effects[effect] as ItemEffectDataT;

            let effectTitle = ItemEffects[effectData.name] || effectData.name + "-failed";
            const displayLength = removeFormat(effectTitle).length;
            const displaySpaces = longestText.length - displayLength;
            const newTitle = " ".repeat(Math.floor(displaySpaces / 2 + 0.5) + 3) + effectTitle;
            this.addLore(newTitle);
        }

        this.updateItem();
    }
}
