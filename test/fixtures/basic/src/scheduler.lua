local Scheduler = {}
Scheduler.__index = Scheduler

function Scheduler.new()
  return setmetatable({ jobs = {} }, Scheduler)
end

function Scheduler:add(job)
  table.insert(self.jobs, job)
end

function Scheduler:run_all()
  for _, job in ipairs(self.jobs) do
    job()
  end
end

local function default_clock()
  return os.time()
end

return Scheduler
