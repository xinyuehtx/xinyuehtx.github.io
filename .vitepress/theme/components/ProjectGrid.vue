<script setup lang="ts">
import { computed } from 'vue'
import ProjectCard from './ProjectCard.vue'
import { projects } from '../projects.generated'

const props = defineProps<{ limit?: number }>()

const list = computed(() => (props.limit ? projects.slice(0, props.limit) : projects))
</script>

<template>
  <div class="pgrid">
    <ProjectCard v-for="p in list" :key="p.repo" :project="p" />
  </div>
</template>
