import { formatClassName, compareClasses, compareClassGroupKeys, classGroupKey } from './className';
import { inSelectedClass, setElectiveRosters, electiveOptions, electiveIdOf } from '../pages/teacher/components/review/assignmentReviewUtils';

test('formats home classes and teaching classes', () => {
  expect(formatClassName({ grade: 2024, name: 3 })).toBe('2024级3班');
  expect(formatClassName({ type: 'elective', title: 'Python 社团' })).toBe('Python 社团');
  expect(formatClassName(null)).toBe('未知班级');
  expect(formatClassName({ type: 'elective' })).toBe('未命名教学班');
});

test('teaching classes sort after home classes', () => {
  const list = [
    { type: 'elective', title: '机器人' },
    { grade: 2023, name: 2 },
    { grade: 2024, name: 1 },
    { type: 'elective', title: '编程' }
  ].sort(compareClasses);
  expect(list.map(c => formatClassName(c))).toEqual(['2024级1班', '2023级2班', '编程', '机器人']);
  expect(['elective', '2023', '2025'].sort(compareClassGroupKeys)).toEqual(['2025', '2023', 'elective']);
  expect(classGroupKey({ type: 'elective' })).toBe('elective');
});

test('review page filters a teaching class by its members', () => {
  setElectiveRosters([
    { _id: 'e1', type: 'elective', title: 'Python', students: [{ _id: 's1' }] },
    { _id: 'e2', type: 'elective', title: '旧社团', status: 'archived', students: [{ _id: 's2' }] },
    { _id: 'a1', grade: 2024, name: 3, students: [{ _id: 's3' }] }
  ]);
  expect(electiveOptions()).toEqual(['Python（社团/选修）']);
  expect(electiveIdOf('Python（社团/选修）')).toBe('e1');
  expect(inSelectedClass('Python（社团/选修）', 2024, 3, 's1')).toBe(true);
  expect(inSelectedClass('Python（社团/选修）', 2024, 3, 's3')).toBe(false);
  expect(inSelectedClass('2024级3班', 2024, 3, 's3')).toBe(true);
  expect(inSelectedClass(null, 2024, 3, 's3')).toBe(true);
});
