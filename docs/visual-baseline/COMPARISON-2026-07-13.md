# Сравнение visual baseline

Дата: 13 июля 2026 года.

## Источники

- Утверждённый baseline: `docs/visual-baseline/`.
- Baseline capture run: `29276337387`.
- Comparator run: `29277336532`.
- Comparator artifact: `visual-evidence-10-1`.
- Artifact ID: `8289881916`.
- Artifact digest: `sha256:df54f82494e4776e045a47277cddc05573458f7a09799a2fb649aa8a4722c9fa`.

## Результат

- cases compared: 14;
- pixel_identical: 14;
- pixel_equivalent: 14;
- antialias_equivalent: 0;
- bytes_identical: 14;
- changed cases: 0;
- missing current cases: 0;
- unexpected current cases: 0;
- runtime failures: 0;
- quality failures: 0;
- horizontal overflow: 0;
- console errors: 0;
- page errors: 0;
- failed requests: 0.

Все 14 кадров пиксельно и побайтово идентичны утверждённому baseline. Допуск антиалиасинга в этом запуске не потребовался.

## Пороги comparator

- `max_channel_delta = 16`;
- `max_low_delta_ratio = 0.005`;
- `hard_max_channel_delta = 32`;
- `hard_max_low_delta_ratio = 0.01`.

Пороги предназначены для будущих ограниченных различий сглаживания шрифта. Изменение размеров, метаданных, геометрии или появление значимых пикселей блокирует workflow.

## Решение

Все строки `data/css_regression_matrix.csv` переведены из `baseline_captured` в `passed`.

Статус `passed` означает, что:

1. baseline сохранён и защищён SHA-256;
2. новый строгий capture завершился без технических ошибок;
3. comparator нашёл все 14 cases;
4. размеры и метаданные совпали;
5. `pixel_equivalent = true` для каждого case;
6. changed, missing и unexpected cases отсутствуют.

Обновлять baseline автоматически запрещено. Любое изменение утверждённых PNG требует отдельного visual review и нового evidence-пакета.
