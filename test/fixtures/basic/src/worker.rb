module Jobs
  RETRY_LIMIT = 3

  class Worker
    def perform(payload)
      payload
    end

    def retry_job(job_id)
      job_id
    end
  end

  def self.enqueue(job)
    job
  end
end
