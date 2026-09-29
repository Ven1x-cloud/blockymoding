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
                    .strength(10.0F, 50.0F)
                    .lightLevel(state -> 5)
                    .explosionResistance(0.5F)
                    .friction(0.75F)
                    .noCollission()
                    .mapColor(net.minecraft.world.level.material.MapColor.COLOR_PURPLE)
                    .randomTicks()
                    .sound(SoundType.STONE));

    public static final Block FARLANDS_GLITCH_PART = registerBlock("farlands_glitch_part", Block::new,
            BlockBehaviour.Properties.of()
                    .strength(23.8F, 118.8F)
                    .lightLevel(state -> 12)
                    .friction(0.30F)
                    .mapColor(net.minecraft.world.level.material.MapColor.GRASS)
                    .randomTicks()
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
        // "farlands_glitch_part" – registratie gebeurt via de statische velden (zie initialize())
    }

}
