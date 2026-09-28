package com.modder.mijn_eerste_mod;

import net.minecraft.core.Registry;
import net.minecraft.core.registries.BuiltInRegistries;
import net.minecraft.core.registries.Registries;
import net.minecraft.resources.ResourceKey;
import net.minecraft.world.level.block.Block;
import net.minecraft.world.level.block.BlockBehaviour;
import net.minecraft.world.level.block.SoundType;

/**
 * Alle blokken van deze mod.
 * ⛏ = blok-eigenschappen pas je hier aan (hardheid, licht, etc.)
 */
public final class ModBlocks {
    private ModBlocks() {}

    public static final Block GLITCHBENCH = registerBlock("glitchbench", Block::new,
            BlockBehaviour.Properties.of()
                    .strength(5.0F, 25.0F)
                    .requiresCorrectToolForDrops()
                    .sound(SoundType.WOOD));

    public static final Block MIJN_WERKBANK = registerBlock("mijn_werkbank", Block::new,
            BlockBehaviour.Properties.of()
                    .strength(5.0F, 25.0F)
                    .requiresCorrectToolForDrops()
                    .sound(SoundType.WOOD));

    public static final Block FARLANDS_GLITCH_PART = registerBlock("farlands_glitch_part", Block::new,
            BlockBehaviour.Properties.of()
                    .strength(23.6F, 117.8F)
                    .lightLevel(state -> 10)
                    .sound(SoundType.STONE));

    /** Registreert een blok met verplichte registry-key (1.21.2+ / 26.x). */
    private static Block registerBlock(String path,
            java.util.function.Function<BlockBehaviour.Properties, Block> factory,
            BlockBehaviour.Properties properties) {
        ResourceKey<Block> key = ResourceKey.create(Registries.BLOCK, ModMain.id(path));
        return Registry.register(BuiltInRegistries.BLOCK, key, factory.apply(properties.setId(key)));
    }

    public static void initialize() {
        // "glitchbench" – registratie gebeurt via de statische velden (zie initialize())
        // "mijn_werkbank" – registratie gebeurt via de statische velden (zie initialize())
        // "farlands_glitch_part" – registratie gebeurt via de statische velden (zie initialize())
    }
}
