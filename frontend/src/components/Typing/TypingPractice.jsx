import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Card, Input, Typography, Space, Statistic, Button, notification, Row, Col, Tag, Drawer, Alert } from 'antd';
import { ReloadOutlined, TrophyOutlined, CheckCircleOutlined, RocketOutlined, OrderedListOutlined } from '@ant-design/icons';
import TypingLeaderboard from './TypingLeaderboard';
import { typingAPI } from '../../services/api';
import { refreshPointBalance } from '../../services/achievementService';

const { Title, Text, Paragraph } = Typography;

const TypingPractice = ({
  text = null,                    // 练习文本内容
  targetSpeed = 30,               // 目标速度（默认30字/分钟）
  targetAccuracy = 90,            // 目标准确率（默认90%）
  timeLimit = 300,                // 时间限制（秒）
  onComplete = null,              // 完成一次练习的回调
  onSpeedUpdate = null,           // 速度更新的回调
  mode = 'standalone',            // 模式：'standalone' 独立模式, 'lesson' 课程模式
  textId: propTextId = null,      // 文本ID（从props传入）
  lessonId = null,                // 课程ID
  activityId = null,              // 活动ID
  existingRecord = null,          // 已存在的记录
  disabled = false,               // 是否禁用
  allowOnce = false               // 是否只允许一次
}) => {
  const [currentText, setCurrentText] = useState('');
  const [userInput, setUserInput] = useState('');
  const [currentTextId, setCurrentTextId] = useState(propTextId);
  const [startTime, setStartTime] = useState(null);
  const [isComposing, setIsComposing] = useState(false);
  const [remainingTime, setRemainingTime] = useState(timeLimit);
  const [stats, setStats] = useState({ wpm: 0, accuracy: 0 });
  const [typingErrors, setTypingErrors] = useState(0); // 添加错误计数
  const timerRef = useRef(null);
  const statsTimerRef = useRef(null); // 添加统计更新定时器引用
  const lastStatsUpdate = useRef(0);
  const practiceStartTime = useRef(null);
  const recordRef = useRef(null);
  const lastConfirmedLength = useRef(0); // 跟踪最后一次确认的输入长度
  const [historicalRecord, setHistoricalRecord] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const userInputRef = useRef(''); // 添加ref用于跟踪最新的输入值，避免闭包问题
  const [showLeaderboard, setShowLeaderboard] = useState(false); // 排行榜抽屉状态
  const [isCompleted, setIsCompleted] = useState(false); // 是否已完成本次练习
  const [completionResult, setCompletionResult] = useState(null); // 完成后的结果信息

  // 通用函数：计算正确字符数
  const countCorrectCharacters = useCallback((input, text) => {
    if (!input || !text) return 0;

    let correctCount = 0;
    const length = Math.min(input.length, text.length);

    for (let i = 0; i < length; i++) {
      if (input[i] === text[i]) {
        correctCount++;
      }
    }

    return correctCount;
  }, []);

  // 计算打字速度（前端计算）- 不包括中文输入法的拼音状态
  const calculateSpeed = useCallback(() => {
    if (!practiceStartTime.current) return 0;

    // 使用确认的字符数而非当前输入框中的全部字符
    // 当处于中文输入法组合状态时，使用上一次确认的长度
    const typedCharacters = isComposing ? lastConfirmedLength.current : userInputRef.current.length;

    // 如果没有输入任何字符，返回0
    if (typedCharacters === 0) return 0;

    const elapsedTimeMs = Date.now() - practiceStartTime.current;
    const elapsedMinutes = elapsedTimeMs / 60000;

    // 避免除以零错误或极小值
    if (elapsedMinutes < 0.05) return 0;

    // 计算正确字符数
    const inputToCheck = isComposing ? userInputRef.current.substring(0, lastConfirmedLength.current) : userInputRef.current;
    const correctCharacters = countCorrectCharacters(inputToCheck, currentText);

    // 计算每分钟打字速度（只计算正确的字符）
    const speed = Math.round(correctCharacters / elapsedMinutes);

    return speed;
  }, [isComposing, currentText, countCorrectCharacters]);

  // 计算准确率（前端计算）
  const calculateAccuracy = useCallback(() => {
    if (!userInputRef.current || !currentText) return 100;

    // 当处于中文输入法组合状态时，使用上一次确认的内容计算准确率
    const inputToCheck = isComposing ? userInputRef.current.substring(0, lastConfirmedLength.current) : userInputRef.current;
    const inputLength = Math.min(inputToCheck.length, currentText.length);

    // 避免除以零错误
    if (inputLength === 0) return 100;

    const correctCharacters = countCorrectCharacters(inputToCheck, currentText);
    return Math.round((correctCharacters / inputLength) * 100);
  }, [currentText, isComposing, countCorrectCharacters]);

  // 更新打字统计数据 - 保存最后一次有效的速度值
  const lastValidSpeed = useRef(0);
  const lastValidAccuracy = useRef(100);

  const updateTypingStats = useCallback(() => {
    const speed = calculateSpeed();
    const accuracy = calculateAccuracy();

    // 只有当计算出的速度不为0时才更新最后有效值
    if (speed > 0) {
      lastValidSpeed.current = speed;
    }

    if (accuracy < 100) {
      lastValidAccuracy.current = accuracy;
    }

    // 使用当前计算值或上次有效值（如果当前值为0）
    const displaySpeed = speed > 0 ? speed : lastValidSpeed.current;
    const displayAccuracy = accuracy;

    setStats({
      wpm: displaySpeed,
      accuracy: displayAccuracy
    });

    if (onSpeedUpdate) {
      onSpeedUpdate(displaySpeed);
    }
  }, [calculateSpeed, calculateAccuracy, onSpeedUpdate]);

  // 初始化练习文本和记录
  useEffect(() => {
    if (text) {
      setCurrentText(text);
    } else {
      // 使用函数调用而不是引用getNewText
      fetchNewText();
    }

    // 如果有已存在的记录，加载记录信息
    if (existingRecord) {
      recordRef.current = existingRecord._id;
      // 不再将历史记录的速度设置到当前stats中
      // 而是只设置到historicalRecord中
      setHistoricalRecord(existingRecord);

      // 如果被禁用（说明是allowedOnce且已完成），则显示用户的输入
      if (disabled && existingRecord.input) {
        setUserInput(existingRecord.input);
        userInputRef.current = existingRecord.input;
      }
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [text, existingRecord, disabled]);

  // 获取打字记录
  const fetchTypingRecord = async () => {
    if (mode === 'lesson' && lessonId && activityId) {
      try {
        const records = await typingAPI.getRecords({ lessonId, activityId });
        if (records && records.length > 0) {
          const latestRecord = records[0];
          recordRef.current = latestRecord._id;
          // 不更新当前速度和准确率，只设置历史记录
          setHistoricalRecord(latestRecord);

          // 如果被禁用，且获取到了记录，显示用户的输入
          if (disabled && latestRecord.input) {
            setUserInput(latestRecord.input);
            userInputRef.current = latestRecord.input;
          }
        }
      } catch (error) {
        notification.error({
          message: '获取打字记录失败',
          description: error.message,
          placement: 'topRight'
        });
      }
    }
  };

  useEffect(() => {
    fetchTypingRecord(); // 在组件加载时获取打字记录
  }, [mode, lessonId, activityId]);

  // 在组件中添加防止拖拽的事件处理
  useEffect(() => {
    const textArea = document.querySelector('textarea');
    if (textArea) {
      // 阻止拖拽开始
      const preventDrag = (e) => {
        e.preventDefault();
        e.stopPropagation();
      };

      // 阻止拖放操作
      const preventDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        notification.warning({
          message: '不允许拖放内容',
          description: '请手动输入文本',
          placement: 'topRight',
          duration: 3
        });
      };

      // 添加所有拖拽相关事件监听器
      textArea.addEventListener('dragover', preventDrag);
      textArea.addEventListener('dragenter', preventDrag);
      textArea.addEventListener('dragleave', preventDrag);
      textArea.addEventListener('drop', preventDrop);

      return () => {
        // 清理事件监听器
        textArea.removeEventListener('dragover', preventDrag);
        textArea.removeEventListener('dragenter', preventDrag);
        textArea.removeEventListener('dragleave', preventDrag);
        textArea.removeEventListener('drop', preventDrop);
      };
    }
  }, []);

  // 提交打字记录
  const submitRecord = useCallback(async () => {
    if (!practiceStartTime.current) {
      return;
    }

    // 如果是课程模式，必须有textId
    if (mode === 'lesson' && !propTextId) {
      return;
    }

    const effectiveTextId = mode === 'lesson' ? propTextId : currentTextId;

    if (!effectiveTextId) {
      return;
    }

    // 清除所有计时器，确保提交后剩余时间不再减少
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (statsTimerRef.current) {
      clearInterval(statsTimerRef.current);
      statsTimerRef.current = null;
    }

    // 直接从输入框获取最新的输入内容
    const currentInput = document.querySelector('textarea')?.value || userInputRef.current;

    // 如果没有输入内容，不提交记录
    if (!currentInput) {
      return;
    }

    // 确定当前输入的确认长度
    const finalLength = isComposing ? lastConfirmedLength.current : currentInput.length;

    // 计算开始时间和结束时间（仅用于本地计算）
    const startTimeObj = new Date(practiceStartTime.current);
    const endTimeObj = new Date();

    // 计算实际用时（毫秒）
    const actualDurationMs = endTimeObj - startTimeObj;
    // 转换为分钟
    const actualDurationMinutes = actualDurationMs / 60000;

    // 计算正确字符数
    const inputToCheck = isComposing ? currentInput.substring(0, lastConfirmedLength.current) : currentInput;
    const correctCharacters = countCorrectCharacters(inputToCheck, currentText);

    // 计算最终速度：正确字符数 ÷ 时间（分钟）
    const finalSpeed = Math.round(correctCharacters / actualDurationMinutes);

    // 使用前端实时计算的准确率
    const currentAccuracy = calculateAccuracy();

    // 判断是否达标
    const isPassed = finalSpeed >= targetSpeed && currentAccuracy >= targetAccuracy;

    try {
      const recordData = {
        textId: effectiveTextId,
        lessonId: mode === 'lesson' ? lessonId : null,
        activityId: mode === 'lesson' ? activityId : null,
        duration: actualDurationMs, // 传递用时而不是时间戳
        input: currentInput,
        targetSpeed,
        targetAccuracy,
        timeLimit,
        // 使用最终计算的速度
        speed: finalSpeed,
        accuracy: currentAccuracy,
        isPassed: isPassed,
        // 添加实际输入的字符数（不含拼音状态）
        confirmedLength: finalLength
      };

      const response = await typingAPI.recordTyping(recordData);

      // 更新打字速度和准确率
      if (response && response.recordId) {
        // 保存recordId以便后续使用
        recordRef.current = response.recordId;

        // 如果获得了积分，刷新积分显示
        if (response.pointsEarned > 0) {
          refreshPointBalance();
        }
      }

      // 返回完整的响应结果，包括后端返回的message和积分信息
      return {
        speed: finalSpeed,
        accuracy: currentAccuracy,
        isPassed: isPassed,
        recordId: response?.recordId,
        message: response?.message,
        shouldSave: response?.shouldSave,
        pointsEarned: response?.pointsEarned || 0
      };
    } catch (error) {
      notification.error({
        message: '提交记录失败',
        description: error.response?.data?.message || error.message,
        placement: 'topRight'
      });
      return null;
    }
  }, [propTextId, currentTextId, lessonId, activityId, targetSpeed, targetAccuracy, userInput, calculateSpeed, calculateAccuracy, mode, currentText, isComposing, countCorrectCharacters]);

  // 重置练习
  const resetPractice = useCallback(() => {
    setUserInput('');
    userInputRef.current = ''; // 重置inputRef
    setStartTime(null);
    practiceStartTime.current = null;
    recordRef.current = null;  // 清除记录ID
    setStats({ wpm: 0, accuracy: 0 });
    setTypingErrors(0); // 重置错误计数
    lastConfirmedLength.current = 0; // 重置确认的输入长度
    setRemainingTime(timeLimit);
    setIsSubmitting(false); // 重置提交状态，确保下一次练习可以正常提交
    setIsCompleted(false); // 重置完成状态
    setCompletionResult(null); // 清除完成结果
    // 清除所有计时器
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (statsTimerRef.current) {
      clearInterval(statsTimerRef.current);
      statsTimerRef.current = null;
    }
  }, [timeLimit, userInput, isSubmitting]);

  // 获取新的练习文本 - 将函数声明提前
  const fetchNewText = useCallback(async () => {
    if (mode === 'lesson') {
      // 课程模式下，只使用指定的文本
      try {
        const response = await typingAPI.getTextById(propTextId);
        if (response && response.content) {
          setCurrentText(response.content);
          setCurrentTextId(propTextId);
        } else {
          notification.error({
            message: '获取练习文本失败',
            placement: 'topRight',
            duration: 3
          });
        }
      } catch (error) {
        notification.error({
          message: '获取练习文本失败',
          placement: 'topRight',
          duration: 3
        });
      }
    } else {
      // 独立模式下，随机获取文本
      try {
        const response = await typingAPI.getTexts();
        if (response && response.length > 0) {
          const randomIndex = Math.floor(Math.random() * response.length);
          const selectedText = response[randomIndex];
          setCurrentText(selectedText.content);
          setCurrentTextId(selectedText._id);
        }
      } catch (error) {
        notification.error({
          message: '获取打字文本失败',
          placement: 'topRight',
          duration: 3
        });
      }
    }
    // 只有在未禁用时才重置练习状态
    // 如果被禁用，说明是查看已完成的记录，不需要重置输入框
    if (!disabled) {
      resetPractice();
    }
  }, [mode, propTextId, resetPractice, disabled]);

  // 为了向后兼容，创建getNewText作为fetchNewText的别名
  const getNewText = fetchNewText;

  // 开始计时器
  const startTimer = useCallback(() => {
    if (!practiceStartTime.current) {
      practiceStartTime.current = Date.now();

      // 初始更新一次统计数据
      updateTypingStats();

      // 设置统计数据更新定时器 - 每秒更新一次
      statsTimerRef.current = setInterval(() => {
        // 只有在有用户输入时才更新速度
        if (userInputRef.current.length > 0 || lastValidSpeed.current > 0) { // 使用ref中的值
          updateTypingStats();
        }
      }, 1000);

      timerRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - practiceStartTime.current) / 1000);
        const newRemaining = timeLimit - elapsed;

        if (newRemaining <= 0) {
          // 不再在这里清除计时器，submitRecord中会处理
          // 只设置剩余时间为0
          setRemainingTime(0);
          if (!isSubmitting) {
            setIsSubmitting(true);
            // 不再更新统计数据，由submitRecord直接计算最终速度
            submitRecord().then(response => {
              if (onComplete) {
                onComplete({
                  speed: response.speed,
                  accuracy: response.accuracy,
                  isPassed: response.isPassed || false,
                  message: response.message,
                  pointsEarned: response.pointsEarned || 0
                });
              }

              if (response?.isPassed) {
                // 不论课程还是独立模式，都显示更详细的鼓励消息
                // 优化通知内容，根据是否提高了成绩来显示不同的鼓励信息
                let notificationMessage = '练习达标！';
                let notificationDescription = `速度：${response.speed}字/分钟，准确率：${response.accuracy}%`;

                // 添加积分信息
                if (response.pointsEarned > 0) {
                  notificationDescription += `，获得积分：${response.pointsEarned}`;
                }

                let notificationIcon = <TrophyOutlined style={{ color: '#ffc53d' }} />;

                // 如果有历史记录，比较是否有提高
                if (historicalRecord) {
                  if (response.speed > historicalRecord.speed) {
                    const improvement = response.speed - historicalRecord.speed;
                    notificationMessage = '太棒了！成绩提高了！';
                    notificationDescription = `速度：${response.speed}字/分钟 (+${improvement.toFixed(1)})`;

                    // 添加积分信息
                    if (response.pointsEarned > 0) {
                      notificationDescription += `，获得积分：${response.pointsEarned}`;
                    }

                    notificationIcon = <RocketOutlined style={{ color: '#1890ff' }} />;
                  }
                } else if (response.speed >= targetSpeed * 1.2) {
                  // 如果没有历史记录但成绩特别好（超过目标的120%）
                  notificationMessage = '惊人的表现！';
                  notificationDescription = `速度：${response.speed}字/分钟，远超目标！`;

                  // 添加积分信息
                  if (response.pointsEarned > 0) {
                    notificationDescription += `，获得积分：${response.pointsEarned}`;
                  }

                  notificationIcon = <TrophyOutlined style={{ color: '#ffc53d' }} />;
                }

                notification.success({
                  message: notificationMessage,
                  description: notificationDescription,
                  icon: notificationIcon,
                  placement: 'topRight',
                  duration: 4
                });
              } else {
                // 未达标时给予更精确但简洁的反馈
                let message = '继续加油！';
                let description = '';

                // 根据具体情况提供不同的反馈
                if (response.speed >= targetSpeed && response.accuracy < targetAccuracy) {
                  message = '速度已达标，准确率需提高！';
                  description = `准确率：${response.accuracy}%，目标：${targetAccuracy}%`;
                } else if (response.speed < targetSpeed && response.accuracy >= targetAccuracy) {
                  message = '准确率已达标，速度需提高！';
                  description = `速度：${response.speed}字/分钟，目标：${targetSpeed}字/分钟`;
                } else if (response.speed < targetSpeed && response.accuracy < targetAccuracy) {
                  // 添加速度和准确率都不达标的情况
                  message = '继续努力！';
                  description = `速度：${response.speed}字/分钟，准确率：${response.accuracy}%`;
                } else {
                  // 这里是保底逻辑，通常不会执行到
                  message = '请继续练习！';
                  description = `速度：${response.speed}字/分钟，准确率：${response.accuracy}%`;
                }

                notification.info({
                  message: message,
                  description: description,
                  placement: 'topRight',
                  duration: 3
                });
              }
            });
          }
        } else {
          setRemainingTime(newRemaining);
        }
      }, 200);
    }
  }, [timeLimit, submitRecord, onComplete, mode, isSubmitting, historicalRecord, targetSpeed, userInput, lastValidSpeed]);

  // 检查文本是否完成
  const checkTextCompletion = useCallback((input) => {
    if (!input || isComposing) return false;
    return input === currentText;
  }, [currentText, isComposing]);

  // 使用 useMemo 缓存渲染的文本
  const renderedText = useMemo(() => {
    const textChunks = [];
    const textArr = currentText.split('');
    let currentChunk = { color: 'inherit', text: '' };
    let errors = 0;

    // 当处于中文输入法组合状态时，只检查已确认的部分
    const inputToRender = isComposing ? userInput.substring(0, lastConfirmedLength.current) : userInput;

    for (let i = 0; i < textArr.length; i++) {
      const char = textArr[i];
      let color = 'inherit';

      if (i < inputToRender.length) {
        color = inputToRender[i] === char ? '#52c41a' : '#ff4d4f';
        // 统计错误
        if (color === '#ff4d4f') {
          errors++;
        }
      }

      if (color === currentChunk.color) {
        currentChunk.text += char;
      } else {
        if (currentChunk.text) {
          textChunks.push(currentChunk);
        }
        currentChunk = { color, text: char };
      }
    }

    if (currentChunk.text) {
      textChunks.push(currentChunk);
    }

    // 更新错误计数
    setTypingErrors(errors);

    return textChunks.map((chunk, index) => (
      <Text
        key={index}
        style={{
          color: chunk.color,
          fontSize: '18px',
          fontFamily: "'SimSun', 'STSong', 'Noto Serif SC', serif",
          userSelect: 'none',
          WebkitUserSelect: 'none',
          MozUserSelect: 'none',
          msUserSelect: 'none'
        }}
      >
        {chunk.text}
      </Text>
    ));
  }, [currentText, userInput, isComposing]);

  // 处理文本完成
  const handleTextComplete = useCallback(() => {
    // submitRecord will clear all timers
    if (!isSubmitting) {
      setIsSubmitting(true);
      submitRecord().then(response => {
        // 标记为已完成，保留输入内容让学生看到自己的输入已被提交
        setIsCompleted(true);

        if (response?.isPassed) {
          setCompletionResult({
            isPassed: true,
            speed: response.speed,
            accuracy: response.accuracy,
            pointsEarned: response.pointsEarned || 0
          });

          let notificationMessage = '练习达标！';
          let notificationDescription = `速度：${response.speed}字/分钟，准确率：${response.accuracy}%`;

          if (response.pointsEarned > 0) {
            notificationDescription += `，获得积分：${response.pointsEarned}`;
          }

          let notificationIcon = <TrophyOutlined style={{ color: '#ffc53d' }} />;

          if (historicalRecord) {
            if (response.speed > historicalRecord.speed) {
              const improvement = response.speed - historicalRecord.speed;
              notificationMessage = '太棒了！成绩提高了！';
              notificationDescription = `速度：${response.speed}字/分钟 (+${improvement.toFixed(1)})`;

              if (response.pointsEarned > 0) {
                notificationDescription += `，获得积分：${response.pointsEarned}`;
              }

              notificationIcon = <RocketOutlined style={{ color: '#1890ff' }} />;
            }
          } else if (response.speed >= targetSpeed * 1.2) {
            notificationMessage = '惊人的表现！';
            notificationDescription = `速度：${response.speed}字/分钟，远超目标！`;

            if (response.pointsEarned > 0) {
              notificationDescription += `，获得积分：${response.pointsEarned}`;
            }

            notificationIcon = <TrophyOutlined style={{ color: '#ffc53d' }} />;
          }

          notification.success({
            message: notificationMessage,
            description: notificationDescription,
            icon: notificationIcon,
            placement: 'topRight',
            duration: 4
          });

          if (onComplete) {
            onComplete({
              speed: response.speed,
              accuracy: response.accuracy,
              isPassed: true,
              message: response.message,
              pointsEarned: response.pointsEarned
            });
          }

          // 不再自动调用 getNewText()，让学生看到自己的输入已提交
          // 学生需要手动点击按钮来开始新的练习
        } else {
          setCompletionResult({
            isPassed: false,
            speed: response?.speed || 0,
            accuracy: response?.accuracy || 0,
            pointsEarned: 0
          });

          let message = '再接再厉！';
          let description = '';

          if (response.speed >= targetSpeed && response.accuracy < targetAccuracy) {
            message = '速度已达标，准确率需提高！';
            description = `准确率：${response.accuracy}%，目标：${targetAccuracy}%`;
          } else if (response.speed < targetSpeed && response.accuracy >= targetAccuracy) {
            message = '准确率已达标，速度需提高！';
            description = `速度：${response.speed}字/分钟，目标：${targetSpeed}字/分钟`;
          } else if (response.speed < targetSpeed && response.accuracy < targetAccuracy) {
            message = '继续努力！';
            description = `速度：${response.speed}字/分钟，准确率：${response.accuracy}%`;
          } else {
            message = '请继续练习！';
            description = `速度：${response.speed}字/分钟，准确率：${response.accuracy}%`;
          }

          notification.info({
            message: message,
            description: description,
            placement: 'topRight',
            duration: 3
          });
        }
      });
    }
  }, [submitRecord, onComplete, targetSpeed, targetAccuracy, isSubmitting, historicalRecord, getNewText, mode]);


  // 处理输入变化
  const handleInputChange = useCallback((e) => {
    const input = e.target.value;
    if (remainingTime === 0) return;

    setUserInput(input);
    userInputRef.current = input; // 同步更新ref

    // 如果不在输入中文状态，更新确认的长度
    if (!isComposing) {
      lastConfirmedLength.current = input.length;
    }

    if (!practiceStartTime.current) {
      // 开始计时
      startTimer();
    }

    // 只在非组合状态下检查文本是否完成
    if (!isComposing && checkTextCompletion(input)) {
      handleTextComplete();
    }
  }, [remainingTime, startTimer, checkTextCompletion, handleTextComplete, isComposing]);

  // 处理组合输入开始（中文输入法）
  const handleCompositionStart = () => {
    setIsComposing(true);
    // 保存当前已确认的输入长度
    lastConfirmedLength.current = userInput.length;
  };

  // 处理组合输入结束（中文输入法）
  const handleCompositionEnd = (e) => {
    setIsComposing(false);
    const input = e.target.value;
    // 更新已确认的输入长度
    lastConfirmedLength.current = input.length;

    // 立即更新状态并强制重新计算速度
    // 注意：直接传入isComposing=false，而不是依赖状态更新
    const speed = calculateSpeedNow(false);
    const accuracy = calculateAccuracyNow(false);

    // 使用最新计算的速度直接更新状态
    if (speed > 0) {
      lastValidSpeed.current = speed;
    }

    setStats({
      wpm: speed > 0 ? speed : lastValidSpeed.current,
      accuracy: accuracy
    });

    // 确保在中文输入结束后检查文本是否完成
    if (practiceStartTime.current && checkTextCompletion(input)) {
      handleTextComplete();
    }
  };

  // 添加不依赖isComposing状态的速度计算函数
  const calculateSpeedNow = (composing) => {
    if (!practiceStartTime.current) return 0;

    // 使用参数决定是否处于组合状态
    const typedCharacters = composing ? lastConfirmedLength.current : userInput.length;

    if (typedCharacters === 0) return 0;

    const elapsedTimeMs = Date.now() - practiceStartTime.current;
    const elapsedMinutes = elapsedTimeMs / 60000;

    if (elapsedMinutes < 0.05) return 0;

    // 计算正确字符数
    const inputToCheck = composing ? userInput.substring(0, lastConfirmedLength.current) : userInput;
    const correctCharacters = countCorrectCharacters(inputToCheck, currentText);

    // 计算每分钟打字速度（只计算正确的字符）
    const speed = Math.round(correctCharacters / elapsedMinutes);

    return speed;
  };

  // 添加不依赖isComposing状态的准确率计算函数
  const calculateAccuracyNow = (composing) => {
    if (!userInput || !currentText) return 100;

    const inputToCheck = composing ? userInput.substring(0, lastConfirmedLength.current) : userInput;
    const inputLength = Math.min(inputToCheck.length, currentText.length);

    if (inputLength === 0) return 100;

    const correctCharacters = countCorrectCharacters(inputToCheck, currentText);
    return Math.round((correctCharacters / inputLength) * 100);
  };

  // 处理粘贴事件
  const handlePaste = (e) => {
    e.preventDefault();
    if (mode === 'lesson') {
      notification.warning({
        message: mode === 'lesson' ? '考核模式下不允许粘贴' : '练习模式下不允许粘贴',
        placement: 'topRight',
        duration: 3
      });
    }
  };

  // 计算进度
  const progress = useMemo(() => {
    if (!userInput || !currentText) return 0;
    return Math.round((userInput.length / currentText.length) * 100);
  }, [userInput, currentText]);

  // 格式化剩余时间
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // 清理副作用
  useEffect(() => {
    return () => {
      // 确保在组件卸载时清除所有计时器
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      if (statsTimerRef.current) {
        clearInterval(statsTimerRef.current);
        statsTimerRef.current = null;
      }
    };
  }, []);

  return (
    <div>

      {mode === 'standalone' && <Title level={2}>打字练习</Title>}
      <Card>
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          {/* 统计信息 */}
          <div style={{ marginBottom: 16 }}>
            <Row gutter={[16, 16]} align="middle">
              <Col span={8}>
                <Statistic
                  title={<Text strong>当前速度</Text>}
                  value={stats.wpm}
                  suffix="字/分钟"
                  valueStyle={{
                    color: stats.wpm >= targetSpeed ? '#52c41a' : '#666666',
                    fontSize: '20px'
                  }}
                />
                {historicalRecord && (
                  <Text type="secondary" style={{ fontSize: '12px' }}>
                    上次记录：{historicalRecord.speed}字/分钟
                    {historicalRecord.isPassed && (
                      <TrophyOutlined style={{ color: '#ffc53d', marginLeft: 8 }} />
                    )}
                  </Text>
                )}
              </Col>
              <Col span={8}>
                <Statistic
                  title={<Text strong>当前准确率</Text>}
                  value={stats.accuracy}
                  suffix="%"
                  valueStyle={{
                    color: stats.accuracy >= targetAccuracy ? '#52c41a' : '#666666',
                    fontSize: '20px'
                  }}
                />
                {historicalRecord && (
                  <Text type="secondary" style={{ fontSize: '12px' }}>
                    上次记录：{historicalRecord.accuracy}%
                  </Text>
                )}
              </Col>
              <Col span={8}>
                <Statistic
                  title={<Text strong>剩余时间</Text>}
                  value={formatTime(remainingTime)}
                  valueStyle={{ fontSize: '20px' }}
                />
              </Col>
            </Row>

            {mode === 'lesson' && (
              <Row style={{ marginTop: 8 }}>
                <Col span={24}>
                  <Space size="large">
                    <Text type="secondary">
                      目标速度：<Text strong style={{ color: '#1890ff' }}>{targetSpeed}</Text> 字/分钟
                    </Text>
                    <Text type="secondary">
                      目标准确率：<Text strong style={{ color: '#1890ff' }}>{targetAccuracy}</Text>%
                    </Text>
                  </Space>
                </Col>
              </Row>
            )}
          </div>

          {/* 练习文本 */}
          <Card
            size="small"
            style={{
              WebkitUserSelect: 'none',
              userSelect: 'none',
            }}
            bodyStyle={{
              height: '150px',
              overflowY: 'auto'
            }}
          >
            <Paragraph
              style={{
                fontSize: '18px',
                WebkitUserSelect: 'none',
                userSelect: 'none'
              }}
            >
              {renderedText}
            </Paragraph>
          </Card>

          {/* 输入区域 */}
          <div style={{ flex: 1, position: 'relative' }}>
            <Input.TextArea
              value={userInput}
              onChange={handleInputChange}
              onPaste={handlePaste}
              onCompositionStart={handleCompositionStart}
              onCompositionEnd={handleCompositionEnd}
              placeholder={remainingTime === 0 ? "时间到！点击重新开始按钮开始新的练习" : "请在此输入..."}
              style={{
                fontSize: '18px',
                fontFamily: "'SimSun', 'STSong', 'Noto Serif SC', serif",
                height: '150px',
                resize: 'none'
              }}
              disabled={remainingTime === 0 || disabled || isCompleted}
            />
            {/* 完成提示覆盖层 */}
            {isCompleted && completionResult && (
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '8px 16px',
                background: completionResult.isPassed
                  ? 'linear-gradient(135deg, rgba(82, 196, 26, 0.95), rgba(56, 158, 13, 0.95))'
                  : 'linear-gradient(135deg, rgba(24, 144, 255, 0.95), rgba(9, 109, 217, 0.95))',
                borderRadius: '8px 8px 0 0',
                zIndex: 1,
                gap: '12px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
              }}>
                {completionResult.isPassed
                  ? <CheckCircleOutlined style={{ color: '#fff', fontSize: '18px' }} />
                  : <RocketOutlined style={{ color: '#fff', fontSize: '18px' }} />}
                <Text style={{ color: '#fff', fontSize: '14px', fontWeight: 500 }}>
                  {completionResult.isPassed ? '已提交，练习达标！' : '已提交，继续加油！'}
                  {' '}速度 {completionResult.speed} 字/分钟，准确率 {completionResult.accuracy}%
                  {completionResult.pointsEarned > 0 && `，+${completionResult.pointsEarned} 积分`}
                </Text>
                <Button
                  size="small"
                  type="primary"
                  ghost
                  style={{ borderColor: '#fff', color: '#fff', marginLeft: 'auto' }}
                  onClick={fetchNewText}
                >
                  {mode === 'lesson' ? '重新练习' : '换一篇继续'}
                </Button>
              </div>
            )}
          </div>

          {/* 按钮区域 */}
          <Space>
            <Button
              type="primary"
              icon={<ReloadOutlined />}
              onClick={fetchNewText}
              disabled={disabled}
            >
              {mode === 'lesson' ? '重新练习' : '换一篇'}
            </Button>
            {mode === 'standalone' && (
              <Button
                icon={<OrderedListOutlined />}
                onClick={() => setShowLeaderboard(true)}
              >
                排行榜
              </Button>
            )}
          </Space>

          {/* 排行榜抽屉 */}
          {mode === 'standalone' && (
            <Drawer
              title={null}
              placement="right"
              width={700}
              open={showLeaderboard}
              onClose={() => setShowLeaderboard(false)}
              bodyStyle={{ padding: 0 }}
            >
              <TypingLeaderboard currentTextId={currentTextId} />
            </Drawer>
          )}
        </Space>
      </Card>
    </div>
  );
};

export default TypingPractice; 