import React, { useState, useEffect, useRef } from "react";
import "./Quiz.css";

const Quiz = () => {
  const [topic, setTopic] = useState("");
  const [numQuestions, setNumQuestions] = useState("5");
  const [timerDuration, setTimerDuration] = useState("10");
  const [questions, setQuestions] = useState([]);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [selectedOption, setSelectedOption] = useState(null);
  const [score, setScore] = useState(0);
  const [quizStarted, setQuizStarted] = useState(false);
  const [quizCompleted, setQuizCompleted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [timer, setTimer] = useState(10);
  const [userAnswers, setUserAnswers] = useState([]);
  const [showCorrect, setShowCorrect] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    if (quizStarted && !quizCompleted && questions.length > 0) {
      setTimer(parseInt(timerDuration) || 10);
      setShowCorrect(false);
      timerRef.current = setInterval(() => {
        setTimer((prev) => {
          if (prev <= 0) {
            clearInterval(timerRef.current);
            handleNext(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timerRef.current);
    }
  }, [currentQuestion, quizStarted, quizCompleted, timerDuration, questions]);

  const handleStartQuiz = async () => {
    const numQ = parseInt(numQuestions);
    const timerD = parseInt(timerDuration);
    if (!topic || isNaN(numQ) || numQ <= 0 || isNaN(timerD) || timerD <= 0) {
      setError(
        "Please enter a valid topic, number of questions, and timer duration."
      );
      return;
    }
    setIsLoading(true);
    setError("");
    try {
      const res = await fetch(
        "https://quiznova-cf1r.onrender.com/api/generate-quiz",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ topic, count: numQ }),
        }
      );
      const data = await res.json();
      if (!res.ok || !data.questions) {
        setError(data.error || "Failed to generate quiz. Try again.");
        return;
      }
      setQuestions(data.questions);
      setQuizStarted(true);
      setUserAnswers([]);
    } catch (err) {
      setError("Failed to generate quiz. Try again.");
      console.error("Failed to generate quiz", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const handlePrintScreen = (e) => {
      if (e.key === "PrintScreen") {
        alert("Screenshots are not allowed during the quiz.");
        const body = document.body;
        const prev = body.style.visibility;
        body.style.visibility = "hidden";
        setTimeout(() => {
          body.style.visibility = prev;
        }, 800);
      }
    };
    window.addEventListener("keydown", handlePrintScreen);
    return () => {
      window.removeEventListener("keydown", handlePrintScreen);
    };
  }, []);

  const handleOptionSelect = (option) => {
    if (!showCorrect) {
      setSelectedOption(option);
      setUserAnswers((prev) => {
        const updated = [...prev];
        const idx = updated.findIndex((ua) => ua.question === currentQuestion);
        if (idx !== -1) {
          updated[idx] = { question: currentQuestion, answer: option };
        } else {
          updated.push({ question: currentQuestion, answer: option });
        }
        return updated;
      });
    }
  };

  const handleNext = (isTimeout = false) => {
    if (
      !isTimeout &&
      selectedOption === questions[currentQuestion].correctAnswer
    ) {
      setScore((s) => s + 1);
    }
    setShowCorrect(false);
    if (currentQuestion + 1 === questions.length) {
      setQuizCompleted(true);
      clearInterval(timerRef.current);
    } else {
      setCurrentQuestion((i) => i + 1);
      setSelectedOption(null);
    }
  };

  const handleRetakeQuiz = () => {
    setQuizStarted(false);
    setQuizCompleted(false);
    setCurrentQuestion(0);
    setScore(0);
    setSelectedOption(null);
    setQuestions([]);
    setUserAnswers([]);
    setTimer(parseInt(timerDuration) || 10);
  };

  if (!quizStarted) {
    return (
      <div
        className="quiz-container"
        style={{ animation: "fadeIn 0.5s ease-in" }}
      >
        <h2 className="quiz-title">QuizNova: Spark Your Knowledge!</h2>
        <div style={{ marginBottom: "1.5rem" }}>
          <div className="input-group">
            <input
              type="text"
              id="topic"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              required
              aria-label="Quiz topic"
              placeholder=" "
            />
            <label htmlFor="topic">Enter Topic</label>
          </div>
          <div className="input-group">
            <input
              type="number"
              id="numQuestions"
              value={numQuestions}
              onChange={(e) => setNumQuestions(e.target.value)}
              min="1"
              required
              aria-label="Number of questions"
              placeholder=" "
            />
            <label htmlFor="numQuestions">Number of Questions</label>
          </div>
          <div className="input-group">
            <input
              type="number"
              id="timerDuration"
              value={timerDuration}
              onChange={(e) => setTimerDuration(e.target.value)}
              min="5"
              required
              aria-label="Timer duration (seconds)"
              placeholder=" "
            />
            <label htmlFor="timerDuration">Timer (seconds per question)</label>
          </div>
        </div>
        <button
          className="next-button"
          style={{
            background: "linear-gradient(to right, #4caf50, #81c784)",
            marginTop: "1rem",
          }}
          onClick={handleStartQuiz}
          disabled={isLoading}
        >
          <i className="fas fa-play" style={{ marginRight: "0.5rem" }}></i>{" "}
          Start Quiz
        </button>
        {error && (
          <p style={{ color: "#f44336", marginTop: "1rem" }}>{error}</p>
        )}
        {isLoading && (
          <p style={{ marginTop: "1rem" }}>
            Generating questions... <i className="fas fa-spinner fa-spin"></i>
          </p>
        )}
      </div>
    );
  }

  if (quizCompleted) {
    return (
      <div
        className="quiz-container result"
        style={{ animation: "fadeIn 0.5s ease-in" }}
      >
        <h2 className="result-title">Quiz Completed!</h2>
        <div
          className="score-circle"
          style={{ animation: "bounceIn 0.8s ease" }}
        >
          {score} / {questions.length}
        </div>
        <div className="result-message">Your Results:</div>
        {questions.map((q, idx) => {
          const userAnswer = userAnswers.find(
            (ua) => ua.question === idx
          )?.answer;
          const isCorrect = userAnswer === q.correctAnswer;
          return (
            <div
              key={idx}
              className="result-info"
              style={{ color: isCorrect ? "#4caf50" : "#f44336" }}
            >
              Q{idx + 1}: {q.text} <br />
              Your Answer: {userAnswer || "None"}{" "}
              {userAnswer && (isCorrect ? "✅" : "❌")} <br />
              Correct Answer: {q.correctAnswer}
            </div>
          );
        })}
        <button
          className="next-button"
          style={{
            background: "linear-gradient(to right, #2196f3, #64b5f6)",
            marginTop: "1.5rem",
          }}
          onClick={handleRetakeQuiz}
        >
          <i className="fas fa-redo" style={{ marginRight: "0.5rem" }}></i>{" "}
          Retake Quiz
        </button>
      </div>
    );
  }

  const q = questions[currentQuestion];
  const progress = ((currentQuestion + 1) / questions.length) * 100;

  return (
    <div className="quiz-container" style={{ animation: "slideIn 0.3s ease" }}>
      <div className="quiz-header">
        <h2 className="quiz-title">Quiz: {topic}</h2>
        <div className="progress-bar">
          <div
            className="progress-fill"
            style={{ width: `${progress}%` }}
          ></div>
        </div>
        <div className="quiz-countdown">{timer} seconds left</div>
        <div className="timer-bar">
          <div
            className="fill"
            style={{
              width: `${(timer / parseInt(timerDuration) || 10) * 100}%`,
            }}
          ></div>
        </div>
        <div
          className="question-text"
          onCopy={(e) => {
            e.preventDefault();
            alert("Copying questions is not allowed.");
          }}
        >
          Q{currentQuestion + 1}/{questions.length}: {q.text}
        </div>
      </div>
      <div className="options-list">
        {q.options.map((opt, i) => (
          <button
            key={i}
            className={`option-btn${selectedOption === opt ? " selected" : ""}${
              showCorrect && opt === q.correctAnswer ? " correct" : ""
            }${
              showCorrect && selectedOption === opt && opt !== q.correctAnswer
                ? " incorrect"
                : ""
            }`}
            onClick={() => handleOptionSelect(opt)}
            disabled={showCorrect}
            style={{
              background:
                showCorrect && opt === q.correctAnswer
                  ? "linear-gradient(to right, #4caf50, #81c784)"
                  : showCorrect &&
                    selectedOption === opt &&
                    opt !== q.correctAnswer
                  ? "linear-gradient(to right, #f44336, #ef5350)"
                  : selectedOption === opt
                  ? "#1976d2"
                  : "#f5f5f5",
              color: showCorrect || selectedOption === opt ? "#fff" : "#333",
            }}
          >
            {opt}
          </button>
        ))}
      </div>
      <div className="quiz-next-btn-row">
        <button
          className="next-button"
          onClick={() => handleNext()}
          disabled={!selectedOption}
        >
          {currentQuestion + 1 === questions.length ? "Finish" : "Next"}
        </button>
      </div>
    </div>
  );
};

export default Quiz;
