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
    public static final BlockItem FARLANDS_GLITCH_PART = registerBlockItem("farlands_glitch_part", ModBlocks.FARLANDS_GLITCH_PART);
    public static final Item GLITCH_TEXTURE = registerItem("glitch_texture", props -> new Item(props.stacksTo(64)));
    public static final Item MIJN_ITEM_2 = registerItem("mijn_item_2", props -> new Item(props.maxDamage(1000).fireResistant().component(net.minecraft.core.component.DataComponents.ENCHANTMENT_GLINT_OVERRIDE, true).enchantable(14).humanoidArmor(new net.minecraft.world.item.ArmorMaterial(1000, java.util.Map.of(net.minecraft.world.item.ArmorType.HELMET, 0, net.minecraft.world.item.ArmorType.CHESTPLATE, 3, net.minecraft.world.item.ArmorType.LEGGINGS, 0, net.minecraft.world.item.ArmorType.BOOTS, 0), 14, net.minecraft.sounds.SoundEvents.ARMOR_EQUIP_IRON, 0.0F, 0.0F, net.minecraft.tags.TagKey.create(net.minecraft.core.registries.BuiltInRegistries.ITEM.key(), net.minecraft.resources.ResourceLocation.fromNamespaceAndPath("mijn_eerste_mod", "repairs_mijn_item_2")), net.minecraft.resources.ResourceKey.create(net.minecraft.world.item.equipment.EquipmentAssets.ROOT_ID, net.minecraft.resources.ResourceLocation.fromNamespaceAndPath("mijn_eerste_mod", "mijn_item_2"))), net.minecraft.world.item.ArmorType.CHESTPLATE)));
    public static final Item GLITCHDRANKJE = registerItem("glitchdrankje", props -> new BMDrinkItem(java.util.List.of(new net.minecraft.world.effect.MobEffectInstance(net.minecraft.core.Holder.direct(net.minecraft.core.registries.BuiltInRegistries.MOB_EFFECT.get(net.minecraft.resources.ResourceLocation.parse("minecraft:speed"))), 1200, 0)), props.maxCount(1)));
    public static final Item GLITCHDRANKJE_SPLASH = registerItem("glitchdrankje_splash", props -> new SplashPotionItem(props.component(net.minecraft.core.component.DataComponents.POTION_CONTENTS, new net.minecraft.world.item.component.PotionContents(java.util.Optional.empty(), java.util.Optional.of(3368652), java.util.List.of(new net.minecraft.world.effect.MobEffectInstance(net.minecraft.core.Holder.direct(net.minecraft.core.registries.BuiltInRegistries.MOB_EFFECT.get(net.minecraft.resources.ResourceLocation.parse("minecraft:speed"))), 1200, 0)))).maxCount(1))); // ⚠️ klassenaam bij twijfel: AI-fix
    public static final Item GLITCHDRANKJE_LINGERING = registerItem("glitchdrankje_lingering", props -> new LingeringPotionItem(props.component(net.minecraft.core.component.DataComponents.POTION_CONTENTS, new net.minecraft.world.item.component.PotionContents(java.util.Optional.empty(), java.util.Optional.of(3368652), java.util.List.of(new net.minecraft.world.effect.MobEffectInstance(net.minecraft.core.Holder.direct(net.minecraft.core.registries.BuiltInRegistries.MOB_EFFECT.get(net.minecraft.resources.ResourceLocation.parse("minecraft:speed"))), 1200, 0)))).maxCount(1))); // ⚠️ klassenaam bij twijfel: AI-fix
    public static final Item GLITCHDRANKJE_ARROW = registerItem("glitchdrankje_arrow", props -> new TippedArrowItem(props.component(net.minecraft.core.component.DataComponents.POTION_CONTENTS, new net.minecraft.world.item.component.PotionContents(java.util.Optional.empty(), java.util.Optional.of(3368652), java.util.List.of(new net.minecraft.world.effect.MobEffectInstance(net.minecraft.core.Holder.direct(net.minecraft.core.registries.BuiltInRegistries.MOB_EFFECT.get(net.minecraft.resources.ResourceLocation.parse("minecraft:speed"))), 1200, 0)))))); // ⚠️ klassenaam bij twijfel: AI-fix
    public static final Item G_LI_TCH_SPAWN_EGG = registerItem("g_li_tch_spawn_egg",
            props -> new SpawnEggItem(ModEntities.G_LI_TCH, 0x000000, 0xb708c4, props)); // ⚠️ als de kleur-ctor weg is: vraag de AI om de component-vorm


    /** Zelf-drinkbaar flesje – effecten direct toepenen (26.3). ⚠️ drink-animatie erbij? → AI-fix. */
    private static class BMDrinkItem extends Item {
        private final java.util.List<net.minecraft.world.effect.MobEffectInstance> effects;

        BMDrinkItem(java.util.List<net.minecraft.world.effect.MobEffectInstance> effects, Item.Properties p) {
            super(p);
            this.effects = effects;
        }

        @Override
        public net.minecraft.world.InteractionResult use(net.minecraft.world.level.Level level, net.minecraft.world.entity.player.Player player, net.minecraft.world.InteractionHand hand) {
            if (!level.isClientSide()) {
                for (net.minecraft.world.effect.MobEffectInstance ie : effects) {
                    player.addEffect(new net.minecraft.world.effect.MobEffectInstance(ie.getEffect(), ie.getDuration(), ie.getAmplifier()));
                }
                net.minecraft.world.item.ItemStack st = player.getItemInHand(hand);
                st.shrink(1);
                if (st.isEmpty()) {
                    player.getInventory().add(new net.minecraft.world.item.ItemStack(net.minecraft.world.item.Items.GLASS_BOTTLE));
                }
                player.swing(hand);
            }
            return net.minecraft.world.InteractionResult.sidedSuccess(level.isClientSide());
        }
    }


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
