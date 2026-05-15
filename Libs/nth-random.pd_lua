local nthrandom = pd.Class:new():register("nth-random")

-- ─────────────────────────────────────
function nthrandom:initialize(name, args)
	self.inlets = 1
	self.outlets = 1
	return true
end

-- ─────────────────────────────────────
function nthrandom:in_1_list(args)
	local count = #args

	if count == 0 then
		return
	end

	local index = math.random(count)
	local value = args[index]

	local t = type(value)
	if t == "number" then
		self:outlet(1, "float", { value })
	elseif t == "string" then
		self:outlet(1, "symbol", { value })
	else
		self:outlet(1, "list", value)
	end
end
-- ─────────────────────────────────────
function nthrandom:in_1_reload()
	self:dofilex(self._scriptname)
	self:initialize()
	pd.post("ok")
end
