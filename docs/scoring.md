# Cách chấm nước đi

Tài liệu này mô tả cách chess-review phân loại nước đi và tính Accuracy. Code nằm ở `src/analysis/`, mọi ngưỡng ở `src/analysis/thresholds.ts`.

## 1. Dữ liệu đầu vào

Với mỗi vị trí `i` (0 = thế cờ đầu, `i` = sau nước thứ `i`), Stockfish 19 phân tích với MultiPV 2:

- `score`: eval tốt nhất (góc nhìn Trắng),
- `bestMove`: nước tốt nhất,
- `lines[0..1]`: hai biến tốt nhất.

Engine nhận vị trí dạng `position fen <startFen> moves …`, nên nhận ra được lặp 3 lần. Vị trí đã kết thúc theo luật (chiếu hết, hòa pat, không đủ quân, lặp 3 lần, luật 50 nước) không gọi engine mà dùng `terminalScore`.

Nước thứ `i` (`plies[i]`) được chấm bằng `evals[i]` (trước) và `evals[i+1]` (sau), cả hai đổi sang **góc nhìn người vừa đi** (`scoreForMover`).

## 2. Win%

Theo công thức công khai của lichess:

```
win% = 50 + 50 · (2 / (1 + e^(−0.00368208 · cp)) − 1),   cp kẹp trong [−1000, 1000]
```

`mate` dương → 100, `mate` âm → 0. Ván kết thúc: thắng 100, thua 0, hòa 50.

`drop = max(0, winBefore − winAfter)`.

## 3. Phân loại (theo chess.com)

Theo định nghĩa chess.com công bố ([How are moves classified?](https://support.chess.com/en/articles/8572705-how-are-moves-classified-what-is-a-blunder-or-brilliant-move), cập nhật 09/02/2026). Chess.com đo bằng **expected points mất đi** (thang 0–1). App dùng win% của người đi (thang 0–100) làm expected points, nên 0.02 tương ứng 2 điểm win%.

Vùng kết quả theo win% của người đi, dùng cho Great và Miss:
- **thua:** dưới 33;
- **cân bằng:** 33–67;
- **thắng:** trên 67 (khoảng +2 Tốt).

Xét theo thứ tự, gặp điều kiện nào đúng trước thì lấy nhãn đó:

| Nhãn | Định nghĩa của chess.com | Cách app tính |
|---|---|---|
| **Brilliant !!** | thí quân tốt, là nước tốt nhất hoặc gần như vậy, sau đó không xấu thế, và nếu không đi nước này thì chưa thắng tuyệt đối | `drop ≤ 2`, là nước thí quân (mục 4), `winAfter ≥ 50`, và nước tốt nhất *khác* nước đã đi có win% < 97 |
| **Great !** | nước quyết định kết quả: cứu thế thua về cân bằng, biến cân bằng thành thắng, hoặc nước tốt duy nhất | là nước tốt nhất, và biến 2 rơi xuống **vùng kết quả tệ hơn** biến 1. Không tính nước chiếu hết và nước ăn lại quân ngay |
| **Best ★** | mất 0 | trùng `bestMove` của engine |
| **Miss ✕** | không tận dụng được nước dở của đối phương, thường để thế cờ về cân bằng hoặc tệ hơn | nước trước của đối phương là Mistake/Miss/Blunder (nhãn của engine), nước này không phải tốt nhất, tụt hơn 5, và làm thế cờ rơi xuống vùng kết quả tệ hơn. Ghi đè Inaccuracy/Mistake/Blunder |
| **Excellent** | mất 0–0.02 | `drop ≤ 2` |
| **Good** | mất 0.02–0.05 | `drop ≤ 5` |
| **Inaccuracy ?!** | mất 0.05–0.10 | `drop ≤ 10` |
| **Mistake ?** | mất 0.10–0.20 | `drop ≤ 20` |
| **Blunder ??** | mất ≥ 0.20 | `drop > 20` |

### Những gì chess.com không công bố (app chỉ làm gần đúng)

- **Công thức expected points theo rating.** Chess.com tính cơ hội thắng dựa trên *cả rating lẫn eval*, nhưng không cho công thức. App dùng đường cong win% của lichess, giống nhau cho mọi rating. Vì vậy với người rating thấp, app có thể chấm khắt khe hơn chess.com một chút.
- **Ranh giới thắng/cân bằng/thua theo rating** (dùng cho Great và Miss). App chia đều 3 vùng 33/67; chỉnh ở `LOSING_BELOW` và `WINNING_ABOVE` trong `thresholds.ts`.
- **Mức "dễ dãi hơn" cho người mới** ở Brilliant và Great: không có số liệu, nên app không điều chỉnh.
- **Nhãn Forced** (chỉ có một nước hợp lệ) không có trong trang định nghĩa, nên app không dùng.
- **Accuracy (CAPS):** không công bố. App dùng công thức của lichess (mục 5).

### Book (nước khai cuộc)

Dữ liệu: [lichess-org/chess-openings](https://github.com/lichess-org/chess-openings) (CC0), commit cố định, sinh bằng `scripts/build-openings.mjs` thành `src/openings/openings.json`:
- **mọi thế cờ** trên đường đi của mỗi biến lý thuyết (7.982 thế cờ, khóa là EPD);
- 3.865 thế cờ trong đó có tên khai cuộc (mã ECO + tên).

Quy tắc:
- **Book** là các nước **liên tiếp từ đầu ván** có thế cờ sau nước đi nằm trong dữ liệu. Lệch khỏi lý thuyết một lần thì dừng, dù sau đó có chuyển thế về một thế cờ lý thuyết. Chuyển thế *trong lúc vẫn còn* lý thuyết thì vẫn nhận ra (khóa là thế cờ, không phải thứ tự nước).
- Ván bắt đầu từ FEN tùy chỉnh không có Book.
- Tên khai cuộc của một nước là tên của thế cờ *có tên* sâu nhất tính tới nước đó. Header của ván hiện tên sâu nhất trong phần Book.
- Như chess.com, nhãn Book **luôn ghi đè** nhãn của engine, kể cả gambit nghi vấn (ví dụ Halloween Gambit `4.Nxe5`).
- Accuracy của nước Book vẫn tính như thường.
- Ngữ cảnh cho nước tiếp theo (luật Miss) luôn dùng nhãn gốc của engine.

Dữ liệu khai cuộc là của lichess, không phải sách khai cuộc của chess.com. Vì vậy số nước Book có thể chênh vài nước so với chess.com.

EPD phụ thuộc vào cách chess.js ghi ô bắt tốt qua đường: chess.js 1.4 chỉ ghi khi bắt được thật. Vì vậy `chess.js` được khóa ở `~1.4.0`, và có test kiểm tra mọi khóa có ô e.p. đều bắt được thật. Khi nâng chess.js, phải chạy lại script build.

### Vì sao Brilliant so với "nước tốt nhất khác"

Trước `16.Qb8+!!` (Morphy, 1858), Trắng đã có thế chiếu hết sau 2 nước, tức winBefore = 100. Chess.com chỉ loại Brilliant khi *không đi nước này* cũng đã thắng tuyệt đối. Vì vậy app so với nước tốt nhất *khác* nước đã đi:
- nếu nước đã đi là biến 1 thì so với biến 2;
- nếu nước đã đi là biến 2 thì so với biến 1.

## 4. Thí quân (heuristic)

`isSacrifice(fenBefore, uci)` trả true khi:

1. quân vừa đi là Mã, Tượng, Xe hoặc Hậu, không phải nước phong cấp, và nước đi không phải chiếu hết;
2. sau nước đi, đối phương có **nước hợp lệ** ăn được quân đó. Chỉ đếm nước hợp lệ, nên quân bị ghim hoặc bên đang bị chiếu (chiếu mở) không tính là ăn được;
3. `giá trị quân − quân vừa ăn − (có quân bảo vệ ? quân rẻ nhất ăn được : 0) ≥ 2`.

Giá trị quân: Tốt 1, Mã 3, Tượng 3, Xe 5, Hậu 9.

Nước phong cấp bị loại vì phong cấp vào ô bị khống chế thường là đổi Tốt lấy quân của đối phương, không phải thí quân.

**Giới hạn đã biết:**

- chỉ xét quân vừa đi, nên không nhận ra kiểu thí quân bằng cách bỏ mặc một quân khác đang bị tấn công;
- không xét thí Tốt.

Chess.com không công khai thuật toán của họ, nên nhãn Brilliant/Great ở đây sẽ khác chess.com ở một số nước.

## 5. Accuracy

### Từng nước

Theo `AccuracyPercent.scala` của lichess:

```
nếu winAfter ≥ winBefore: 100
ngược lại: 103.1668 · e^(−0.04354 · drop) − 3.1669 + 1      (kẹp [0, 100])
```

Phần `+ 1` là "uncertainty bonus" trong code lichess, bù cho việc phân tích không hoàn hảo.

### Cả ván

Mỗi bên được tính như sau:

1. `whiteWins` = win% của Trắng tại mọi vị trí (n + 1 giá trị).
2. Cửa sổ trượt kích thước `clamp(⌊n/10⌋, 2, 8)`. Thêm `(kích thước − 2)` cửa sổ đầu lặp lại, để mỗi nước có đúng một cửa sổ.
3. Trọng số của nước = độ lệch chuẩn của win% trong cửa sổ, kẹp [0.5, 12]. Nước ở đoạn ván biến động mạnh được tính nặng hơn.
4. Accuracy của bên đó = (trung bình có trọng số + trung bình điều hòa) / 2, tính trên các nước của bên đó.

Trung bình điều hòa phạt nặng các nước rất tệ. Giống lichess (`Maths.harmonicMean`), mỗi mẫu được kẹp ≥ 1, nên một nước accuracy 0 không kéo cả trung bình về 0.

### Chỗ khác lichess

- **Mate**: ở đây mate cho win% = 100/0. Lichess đổi mate thành cp ±1000 (win% ≈ 97.5) khi tính accuracy. Vì vậy một nước bỏ lỡ chiếu hết nhưng vẫn thắng lớn bị trừ nhẹ ở đây, còn lichess thì không.
- **Thế cờ đầu**: eval lấy từ engine. Lichess dùng hằng số Cp(15).
- **Engine/độ sâu khác nhau**, nên Accuracy chỉ gần đúng so với lichess, không khớp tuyệt đối.

## 6. Độ tái lập

Stockfish chạy đa luồng nên kết quả không hoàn toàn giống nhau giữa các lần phân tích. Một nước sát ngưỡng có thể đổi giữa Mistake và Blunder. `ucinewgame` được gửi trước mỗi ván để hash của ván trước không ảnh hưởng.
