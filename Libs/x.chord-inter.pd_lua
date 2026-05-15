local chordinter = pd.Class:new():register("x.chord-inter")

-- ─────────────────────────────────────
function chordinter:initialize(name, args)
	self.inlets = 4
	self.outlets = 1

	self.steps = 20
	self.current_step = 1

	self.chord1 = nil
	self.chord2 = nil
	self.chords = nil

	return true
end

-- ─────────────────────────────────────
function chordinter:expand_to_size(chord, size)
	local out = {}
	for i = 1, size do
		out[i] = chord[((i - 1) % #chord) + 1]
	end
	return out
end

-- ─────────────────────────────────────
function chordinter:ease_exponential(t, k)
	k = k or 5.0
	return (math.exp(k * t) - 1) / (math.exp(k) - 1)
end

-- ─────────────────────────────────────
function chordinter:interpolate(a, b, t)
	return a + (b - a) * t
end

-- ─────────────────────────────────────
function chordinter:round(x)
	return math.floor(x + 0.5)
end

-- ─────────────────────────────────────
function chordinter:density(t)
	local minN = #self.chord1
	local maxN = #self.chord2
	return math.floor(minN + (maxN - minN) * t + 0.5)
end

-- ─────────────────────────────────────
function chordinter:generate_chord_progression(chordA, chordB, steps)
	if not chordA or not chordB then
		return nil
	end

	if steps <= 1 then
		return { chordA }
	end

	local max_size = math.max(#chordA, #chordB)

	local A = self:expand_to_size(chordA, max_size)
	local B = self:expand_to_size(chordB, max_size)

	local progression = {}

	for step = 0, steps - 1 do
		local t_linear = step / (steps - 1)
		-- local t = self:ease_exponential(t_linear, 5.0)
		local t = t_linear

		local size = math.max(1, self:density(t))

		local full = {}

		for i = 1, max_size do
			full[i] = self:interpolate(A[i], B[i], t)
		end

		local chord = {}

		for i = 1, size do
			local idx
			if size == 1 then
				idx = 1
			else
				idx = math.floor((i - 1) * (max_size - 1) / (size - 1)) + 1
			end

			chord[i] = self:round(full[idx])
		end

		progression[#progression + 1] = chord
	end

	return progression
end

-- ─────────────────────────────────────
function chordinter:update()
	if not (self.chord1 and self.chord2) then
		return
	end

	self.chords = self:generate_chord_progression(self.chord1, self.chord2, self.steps)

	if self.current_step and self.chords then
		self.current_step = math.max(1, math.min(self.current_step, #self.chords))
	end
end

-- ─────────────────────────────────────
function chordinter:in_1_float(f)
	self.current_step = math.floor(f)

	if self.chords then
		local idx = math.max(1, math.min(self.current_step, #self.chords))
		self:outlet(1, "list", self.chords[idx])
	end
end

-- ─────────────────────────────────────
function chordinter:in_2_float(f)
	self.steps = math.max(1, math.floor(f))
	self:update()
end

-- ─────────────────────────────────────
function chordinter:in_3_list(args)
	if type(args[1]) == "string" then
		table.remove(args, 1)
	end

	self.chord1 = args
	self:update()
end

-- ─────────────────────────────────────
function chordinter:in_4_list(args)
	if type(args[1]) == "string" then
		table.remove(args, 1)
	end

	self.chord2 = args
	self:update()
end

-- ─────────────────────────────────────
function chordinter:in_1_reload()
	self:dofilex(self._scriptname)
	self:initialize()
	pd.post("ok")
end
