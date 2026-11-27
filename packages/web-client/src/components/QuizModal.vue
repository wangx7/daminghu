<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { pickQuizQuestion, type QuizQuestion } from '@daminghu/shared';
import { useGameStore } from '../stores/gameStore';

const emit = defineEmits<{
  (e: 'unlocked'): void;
}>();

const store = useGameStore();
const question = ref<QuizQuestion>(pickQuizQuestion(store.quizCategory));
const selectedIdx = ref<number | null>(null);
const solvedCount = ref(0);

const quiz = computed(() => store.activeQuiz);
const isCorrect = computed(() => selectedIdx.value !== null && selectedIdx.value === question.value.answerIndex);
const isWrong = computed(() => selectedIdx.value !== null && selectedIdx.value !== question.value.answerIndex);

watch(
  () => store.activeQuiz,
  (next) => {
    if (next) {
      solvedCount.value = 0;
      selectedIdx.value = null;
      question.value = pickQuizQuestion(store.quizCategory);
    }
  },
);

function choose(idx: number) {
  if (selectedIdx.value !== null) return;
  selectedIdx.value = idx;
  if (idx === question.value.answerIndex) {
    solvedCount.value++;
    store.totalQuizSolved++;
    store.persistUnlocks();
  }
}

function nextStep() {
  if (!quiz.value) return;
  if (isCorrect.value && solvedCount.value >= quiz.value.requiredCount) {
    const cb = quiz.value.onSuccess;
    store.activeQuiz = null;
    cb();
    emit('unlocked');
    return;
  }
  selectedIdx.value = null;
  question.value = pickQuizQuestion(store.quizCategory);
}

function closeIfAllowed() {
  if (quiz.value?.mandatory) return;
  store.activeQuiz = null;
}
</script>

<template>
  <div v-if="quiz" class="modal-backdrop quiz-backdrop" @click.self="closeIfAllowed">
    <div class="quiz-card">
      <div class="quiz-top">
        <span class="quiz-seal">书院</span>
        <div class="quiz-title-box">
          <h3>{{ quiz.title }}</h3>
          <span>{{ quiz.subtitle }}（进度 {{ solvedCount }}/{{ quiz.requiredCount }}）</span>
        </div>
        <button v-if="!quiz.mandatory" class="close-btn" @click="closeIfAllowed">✕</button>
      </div>

      <div class="quiz-badge-row">
        <span class="skin-pill">{{ question.badge }}</span>
        <span class="quiz-hint">💡 {{ question.hint }}</span>
      </div>

      <div class="quiz-prompt">{{ question.prompt }}</div>

      <div class="quiz-options">
        <button
          v-for="(opt, idx) in question.options"
          :key="idx"
          class="quiz-opt-btn"
          :class="{
            correct: selectedIdx !== null && idx === question.answerIndex,
            wrong: selectedIdx === idx && idx !== question.answerIndex,
          }"
          @click="choose(idx)"
        >
          <span class="opt-letter">{{ ['A', 'B', 'C', 'D'][idx] }}</span>
          <span>{{ opt }}</span>
        </button>
      </div>

      <div v-if="selectedIdx !== null" class="quiz-feedback" :class="{ ok: isCorrect, err: isWrong }">
        <div>
          <strong>{{ isCorrect ? '🎉 答对啦！太棒了！' : '🌿 差一点点，再接再厉！' }}</strong>
          <p>{{ question.explanation }}</p>
        </div>
        <button class="primary-btn" @click="nextStep">
          {{ isCorrect && solvedCount >= quiz.requiredCount ? '完成领奖' : '下一题' }}
        </button>
      </div>
    </div>
  </div>
</template>
