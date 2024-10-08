import { ActionFormData, ActionFormResponse, FormCancelationReason } from '@minecraft/server-ui';
import { Player } from "@minecraft/server";
import { typeIdToDataId, typeIdToID } from "./typeIds.js";
import { settingsHandler } from '../extensions/SettingsHandler.js';

const number_of_1_16_100_items = 0;

/**
 * Enum representing the possible sizes for the chest UI.
 */
export enum ChestSize {
    SINGLE = 'single',
    SMALL = 'small',
    DOUBLE = 'double',
    LARGE = 'large',
    SIZE_5 = '5',
    SIZE_9 = '9',
    SIZE_18 = '18',
    SIZE_27 = '27',
    SIZE_36 = '36',
    SIZE_45 = '45',
    SIZE_54 = '54',
}

/**
 * Mapping of chest sizes to their corresponding titles and slot counts.
 */
const sizes = new Map<ChestSize, [string, number]>([
    [ChestSize.SINGLE, ['§c§h§e§s§t§2§7§r', 27]],
    [ChestSize.SMALL, ['§c§h§e§s§t§2§7§r', 27]],
    [ChestSize.DOUBLE, ['§c§h§e§s§t§5§4§r', 54]],
    [ChestSize.LARGE, ['§c§h§e§s§t§5§4§r', 54]],
    [ChestSize.SIZE_5, ['§c§h§e§s§t§0§5§r', 5]],
    [ChestSize.SIZE_9, ['§c§h§e§s§t§0§9§r', 9]],
    [ChestSize.SIZE_18, ['§c§h§e§s§t§1§8§r', 18]],
    [ChestSize.SIZE_27, ['§c§h§e§s§t§2§7§r', 27]],
    [ChestSize.SIZE_36, ['§c§h§e§s§t§3§6§r', 36]],
    [ChestSize.SIZE_45, ['§c§h§e§s§t§4§5§r', 45]],
    [ChestSize.SIZE_54, ['§c§h§e§s§t§5§4§r', 54]],
]);

/**
 * Class representing a chest-style UI form.
 */
export class ChestFormData {
    private titleText: string;
    private buttonArray: Array<[string, string | number | undefined]>;
    public readonly slotCount: number;

    /**
     * Creates an instance of ChestFormData.
     * @param size - The size of the chest UI.
     */
    constructor(size: ChestSize = ChestSize.SMALL) {
        const [title, slots] = sizes.get(size) ?? ['§c§h§e§s§t§2§7§r', 27];
        this.titleText = title;
        this.buttonArray = Array.from({ length: slots }, () => ['', undefined]);
        this.slotCount = slots;
    }

    /**
     * Sets the title for the chest UI.
     * @param text - The title text for the chest UI.
     * @returns The ChestFormData instance.
     */
    public title(text: string): this {
        this.titleText += text;
        return this;
    }

    /**
     * Adds a button to this chest UI with an icon from a resource pack.
     * @param slot - The slot to display the item in.
     * @param itemName - The name of the item to display.
     * @param itemDesc - The item's lore to display.
     * @param texture - The type ID or the path to the texture. **YOU MUST INCLUDE THE ITEM PREFIX!** For vanilla, it is `minecraft:`.
     * @param stackAmount - The stack size for the item. Clamped between 1 & 99.
     * @param enchanted - If the item is enchanted or not.
     * @returns The ChestFormData instance.
     */
    public button(
        slot: number,
        itemName: string = '',
        itemDesc: string[] = [],
        texture: string = '',
        stackAmount: number = 1,
        enchanted: boolean = false
    ): this {
        //if (slot < 0 || slot >= this.slotCount) {
            //throw new Error(`Slot index out of bounds. Valid range: 0 - ${this.slotCount - 1}`);
        //}

        const ID = typeIdToDataId.get(texture) ?? typeIdToID.get(texture);
        const itemText = `stack#${Math.min(Math.max(stackAmount, 1), 99)
            .toString()
            .padStart(2, '0')}§r${itemName}§r${itemDesc.length ? `\n§r${itemDesc.join('\n§r')}` : ''}`;

        const iconPath = (ID !== undefined) 
            ? (((ID + (ID < 260 ? 0 : number_of_1_16_100_items)) * 65536) + (enchanted ? 32768 : 0)) 
            : texture;

        this.buttonArray[slot] = [itemText, iconPath];
        return this;
    }

    /**
     * Fills slots based on strings and a key, with the first slot being the coordinate that the pattern starts at.
     * @param pattern - The pattern to use, with characters not defined in the key being left empty.
     * @param key - The data to display for each character in the pattern.
     * @returns The ChestFormData instance.
     */
    public pattern(
        pattern: string[],
        key: { [key: string]: { itemName?: string; itemDesc?: string[]; stackAmount?: number; enchanted?: boolean; texture: string } }
    ): this {
        const slotCount = this.slotCount;
        const numRows = pattern.length;
        const numCols = 9; // Assuming the UI has 9 columns

        for (let rowIndex = 0; rowIndex < numRows; rowIndex++) {
            const row = pattern[rowIndex];
            for (let colIndex = 0; colIndex < row.length; colIndex++) {
                const char = row[colIndex];
                const data = key[char];
                const slot = colIndex + rowIndex * numCols;

                if (data && slot < slotCount) {
                    this.button(slot, data.itemName, data.itemDesc, data.texture, data.stackAmount, data.enchanted);
                }
            }
        }

        return this;
    }

    /**
     * Creates and shows this modal popup form. Returns asynchronously when the player confirms or cancels the dialog.
     * @param player - The player to show this dialog to.
     * @returns A promise that resolves with the form response.
     */
    public async show(player: Player): Promise<ActionFormResponse> {
        const form = new ActionFormData().title(this.titleText);
        this.buttonArray.forEach(([text, iconPath]) => {
            form.button(text, iconPath?.toString());
        });

        // @ts-ignore
        return form.show(player);
    }
}

export function queueForm(player: Player, form: ActionFormData, callback: (response: ActionFormResponse) => void) {
    // @ts-ignore
    form.show(player).then((response) => {
        if (response.canceled) {
            // If the player is currently busy, then retry
            if (response.cancelationReason == FormCancelationReason.UserBusy) {
                queueForm(player, form, callback);
            }
            return;
        };

        callback(response);
    }).catch(err => {
        console.error(err);
    });
}