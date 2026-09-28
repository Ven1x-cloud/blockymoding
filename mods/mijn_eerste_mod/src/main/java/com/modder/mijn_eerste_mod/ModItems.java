package com.modder.mijn_eerste_mod;

import net.minecraft.core.Registry;
import net.minecraft.core.registries.BuiltInRegistries;
import net.minecraft.core.registries.Registries;
import net.minecraft.resources.ResourceKey;
import net.minecraft.world.item.BlockItem;
import net.minecraft.world.item.Item;
import net.minecraft.world.item.SpawnEggItem;
import net.minecraft.world.level.block.Block;

/**
 * Alle items van deze mod (incl. blok-items en spawn-eggs).
 * Items/blokken krijgen automatisch de juiste translation-key.
 */
public final class ModItems {
    private ModItems() {}

    public static final BlockItem GLITCHBENCH = registerBlockItem("glitchbench", ModBlocks.GLITCHBENCH);
    public static final BlockItem MIJN_WERKBANK = registerBlockItem("mijn_werkbank", ModBlocks.MIJN_WERKBANK);
    public static final BlockItem FARLANDS_GLITCH_PART = registerBlockItem("farlands_glitch_part", ModBlocks.FARLANDS_GLITCH_PART);
    public static final Item GLITCH_TEXTURE = registerItem("glitch_texture", props -> new Item(props.stacksTo(64)));
    public static final Item G_LI_TCH_SPAWN_EGG = registerItem("g_li_tch_spawn_egg",
            props -> new SpawnEggItem(ModEntities.G_LI_TCH, 0x000000, 0xb708c4, props)); // ⚠️ als de kleur-ctor weg is: vraag de AI om de component-vorm

    private static Item registerItem(String path,
            java.util.function.Function<Item.Properties, Item> factory) {
        ResourceKey<Item> key = ResourceKey.create(Registries.ITEM, ModMain.id(path));
        Item item = factory.apply(new Item.Properties().setId(key));
        Registry.register(BuiltInRegistries.ITEM, key, item);
        return item;
    }

    private static BlockItem registerBlockItem(String path, Block block) {
        ResourceKey<Item> key = ResourceKey.create(Registries.ITEM, ModMain.id(path));
        BlockItem item = new BlockItem(block, new Item.Properties().useBlockDescriptionPrefix().setId(key));
        Registry.register(BuiltInRegistries.ITEM, key, item);
        return item;
    }

    public static void initialize() {
        // geladen via statische velden
    }
}
